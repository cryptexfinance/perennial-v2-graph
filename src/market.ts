import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts'
import {
  OrderCreated as OrderCreatedEvent,
  AccountPositionProcessed as AccountPositionProcessedEvent,
  BeneficiaryUpdated as BeneficiaryUpdatedEvent,
  CoordinatorUpdated as CoordinatorUpdatedEvent,
  FeeClaimed as FeeClaimedEvent,
  Initialized as InitializedEvent,
  Market,
  ParameterUpdated as ParameterUpdatedEvent,
  PositionProcessed as PositionProcessedEvent,
  RiskParameterUpdated as RiskParameterUpdatedEvent,
  Updated as UpdatedEvent,
} from '../generated/templates/Market/Market'
import {
  AccountPositionProcessed,
  BeneficiaryUpdated,
  CoordinatorUpdated,
  FeeClaimed,
  MarketAccumulator,
  MarketGlobalPosition,
  MarketAccountPosition,
  MarketInitialized,
  MarketParameterUpdated,
  PositionProcessed,
  RiskParameterUpdated,
  Updated,
  MarketAccountCheckpoint,
  MarketVersionPrice,
  AccountGlobalAccumulator,
  OrderCreated,
} from '../generated/schema'
import { accumulatorAccumulated, accumulatorIncrement, mul, div, fromBig18, BASE } from './utils/big6Math'
import { latestPrice, magnitude, price, side } from './utils/position'
import { SECONDS_PER_YEAR, updateBucketedVolumes } from './utils/volume'

// event InterfaceFeeCharged(address indexed account, IMarket indexed market, InterfaceFee fee);
const INTERFACE_FEE_TOPIC_21 = Bytes.fromHexString('0x7bdf48e07cd0f3669b6ef1a2004307c0c28e2c22d70ae7a6d8e1ea1b42690591')

// event  (address indexed sender, uint256 applicableGas, uint256 applicableValue, uint256 baseFee, uint256 calldataFee, uint256 keeperFee)
const ORDER_FEE_TOPIC = Bytes.fromHexString('0xfa0333956d06e335c550bd5fc4ac9c003c6545e371331b1071fa4d5d8519d6c1')

export function handleAccountPositionProcessed(event: AccountPositionProcessedEvent): void {
  let entity = new AccountPositionProcessed(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.account = event.params.account
  entity.fromOracleVersion = event.params.fromOracleVersion
  entity.toOracleVersion = event.params.toOracleVersion
  entity.fromPosition = event.params.fromPosition
  entity.toPosition = event.params.toPosition
  entity.accumulationResult_collateralAmount = event.params.accumulationResult.collateralAmount
  entity.accumulationResult_rewardAmount = event.params.accumulationResult.rewardAmount
  entity.accumulationResult_positionFee = event.params.accumulationResult.positionFee
  entity.accumulationResult_keeper = event.params.accumulationResult.keeper

  // Price impact fee is the portion of the position fee that is paid to the market
  const processEvent = PositionProcessed.load(positionProcessedID(event.address, event.params.fromOracleVersion))
  const positionFee =
    processEvent &&
    processEvent.accumulationResult_positionFeeMaker
      .plus(processEvent.accumulationResult_positionFeeFee)
      .gt(BigInt.zero())
      ? div(
          processEvent.accumulationResult_positionFeeFee,
          processEvent.accumulationResult_positionFeeMaker.plus(processEvent.accumulationResult_positionFeeFee),
        )
      : BigInt.zero()
  entity.priceImpactFee = entity.accumulationResult_positionFee.minus(
    mul(entity.accumulationResult_positionFee, positionFee),
  )

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  const fromMarketAccumulator = MarketAccumulator.load(
    marketAccumulatorId(event.address, event.params.fromOracleVersion),
  )
  const toMarketAccumulator = MarketAccumulator.load(marketAccumulatorId(event.address, event.params.toOracleVersion))
  if (
    (event.params.fromOracleVersion.gt(BigInt.zero()) && fromMarketAccumulator === null) ||
    (event.params.toOracleVersion.gt(BigInt.zero()) && toMarketAccumulator === null)
  )
    throw new Error('Accumulator not found')
  // Use the most recent valid position for size
  const localPosition = getOrCreateMarketAccountPosition(
    event.address,
    event.params.account,
    event.block.number,
    event.block.timestamp,
    event.params.toOracleVersion,
  )
  const magnitude_ = magnitude(localPosition.maker, localPosition.long, localPosition.short)
  const side_ = side(localPosition.maker, localPosition.long, localPosition.short)

  entity.side = side_
  entity.size = magnitude_
  entity.collateral = localPosition.collateral
  if (fromMarketAccumulator !== null && toMarketAccumulator !== null) {
    entity.accumulatedPnl = accumulatorAccumulated(toMarketAccumulator, fromMarketAccumulator, magnitude_, side_, 'pnl')
    entity.accumulatedFunding = accumulatorAccumulated(
      toMarketAccumulator,
      fromMarketAccumulator,
      magnitude_,
      side_,
      'funding',
    )
    entity.accumulatedInterest = accumulatorAccumulated(
      toMarketAccumulator,
      fromMarketAccumulator,
      magnitude_,
      side_,
      'interest',
    )
    entity.accumulatedMakerPositionFee = accumulatorAccumulated(
      toMarketAccumulator,
      fromMarketAccumulator,
      magnitude_,
      side_,
      'positionFee',
    )
    entity.accumulatedValue = accumulatorAccumulated(
      toMarketAccumulator,
      fromMarketAccumulator,
      magnitude_,
      side_,
      'value',
    )
    entity.accumulatedReward = accumulatorAccumulated(
      toMarketAccumulator,
      fromMarketAccumulator,
      magnitude_,
      side_,
      'reward',
    )
  } else {
    entity.accumulatedPnl = BigInt.zero()
    entity.accumulatedFunding = BigInt.zero()
    entity.accumulatedInterest = BigInt.zero()
    entity.accumulatedMakerPositionFee = BigInt.zero()
    entity.accumulatedValue = BigInt.zero()
    entity.accumulatedReward = BigInt.zero()
  }

  const toVersionData = Market.bind(event.address).versions(event.params.toOracleVersion)
  const updateEvent = Updated.load(updatedId(event.address, event.params.account, event.params.toOracleVersion))
  if (updateEvent !== null) {
    entity.update = updateEvent.id
  }

  if (toVersionData.valid) {
    entity.toVersionValid = true
    entity.toVersionPrice = getOrCreateMarketVersionPrice(event.address, event.params.toOracleVersion)
    if (updateEvent !== null) {
      updateEvent.valid = true
      updateEvent.price = entity.toVersionPrice
      updateEvent.positionFee = entity.accumulationResult_positionFee
      updateEvent.priceImpactFee = entity.priceImpactFee
      updateEvent.delta = magnitude(updateEvent.newMaker, updateEvent.newLong, updateEvent.newShort).minus(entity.size)
      updateEvent.save()
    }
  } else {
    entity.toVersionValid = false
    entity.toVersionPrice = BigInt.zero()
    // reset update to 0 delta if invalid
    if (updateEvent !== null) {
      updateEvent.delta = BigInt.zero()
      updateEvent.save()
    }
  }

  entity.save()

  updateMarketAccountPosition(event, entity)
}

export function updateMarketAccountPosition(
  event: AccountPositionProcessedEvent,
  positionPrcessedEntity: AccountPositionProcessed,
): void {
  const market = event.address
  const account = event.params.account
  const version = event.params.toOracleVersion
  let marketAccountPosition = getOrCreateMarketAccountPosition(
    market,
    account,
    event.block.number,
    event.block.timestamp,
    version,
  )

  // Settlement
  // Settle accumulationed values
  marketAccountPosition.accumulatedPnl = marketAccountPosition.accumulatedPnl.plus(
    positionPrcessedEntity.accumulatedPnl,
  )
  marketAccountPosition.accumulatedFunding = marketAccountPosition.accumulatedFunding.plus(
    positionPrcessedEntity.accumulatedFunding,
  )
  marketAccountPosition.accumulatedInterest = marketAccountPosition.accumulatedInterest.plus(
    positionPrcessedEntity.accumulatedInterest,
  )
  marketAccountPosition.accumulatedMakerPositionFee = marketAccountPosition.accumulatedMakerPositionFee.plus(
    positionPrcessedEntity.accumulatedMakerPositionFee,
  )
  marketAccountPosition.accumulatedValue = marketAccountPosition.accumulatedValue.plus(
    positionPrcessedEntity.accumulatedValue,
  )
  marketAccountPosition.accumulatedReward = marketAccountPosition.accumulatedReward.plus(
    positionPrcessedEntity.accumulatedReward,
  )
  marketAccountPosition.accumulatedCollateral = marketAccountPosition.accumulatedCollateral.plus(
    event.params.accumulationResult.collateralAmount,
  )
  marketAccountPosition.accumulatedKeeperFees = marketAccountPosition.accumulatedKeeperFees.plus(
    event.params.accumulationResult.keeper,
  )
  marketAccountPosition.accumulatedPositionFees = marketAccountPosition.accumulatedPositionFees.plus(
    event.params.accumulationResult.positionFee,
  )
  marketAccountPosition.accumulatedPriceImpactFees = marketAccountPosition.accumulatedPriceImpactFees.plus(
    positionPrcessedEntity.priceImpactFee,
  )

  const weight = event.params.toOracleVersion.minus(event.params.fromOracleVersion)
  marketAccountPosition.totalWeight = marketAccountPosition.totalWeight.plus(weight)
  if (positionPrcessedEntity.collateral.gt(BigInt.zero())) {
    // annualize values
    marketAccountPosition.weightedFunding = marketAccountPosition.weightedFunding.plus(
      div(positionPrcessedEntity.accumulatedFunding.times(SECONDS_PER_YEAR), positionPrcessedEntity.collateral),
    )
    marketAccountPosition.weightedInterest = marketAccountPosition.weightedInterest.plus(
      div(positionPrcessedEntity.accumulatedInterest.times(SECONDS_PER_YEAR), positionPrcessedEntity.collateral),
    )
    marketAccountPosition.weightedMakerPositionFees = marketAccountPosition.weightedMakerPositionFees.plus(
      div(
        positionPrcessedEntity.accumulatedMakerPositionFee.times(SECONDS_PER_YEAR),
        positionPrcessedEntity.collateral,
      ),
    )
  }

  // Stamp latest collateral
  // Collateral = netDeposits + accumulatedCollateral - accumulatedPositionFees - accumulatedKeeperFees
  marketAccountPosition.collateral = marketAccountPosition.netDeposits
    .plus(marketAccountPosition.accumulatedCollateral)
    .minus(marketAccountPosition.accumulatedPositionFees)
    .minus(marketAccountPosition.accumulatedKeeperFees)

  // Update position if valid
  const marketContract = Market.bind(market)
  const toVersionData = marketContract.versions(version)
  const currentMagnitude = magnitude(
    marketAccountPosition.maker,
    marketAccountPosition.long,
    marketAccountPosition.short,
  )
  const currentSide = side(marketAccountPosition.maker, marketAccountPosition.long, marketAccountPosition.short)

  let notionalVolume = BigInt.zero()
  if (event.params.fromPosition.lt(event.params.toPosition)) {
    let toPosition = marketContract.pendingPositions(event.params.account, event.params.toPosition)
    // If valid, transition the position with invalidation
    if (toVersionData.valid) {
      marketAccountPosition.maker = toPosition.maker.plus(
        marketAccountPosition.makerInvalidation.minus(toPosition.invalidation.maker),
      )
      marketAccountPosition.long = toPosition.long.plus(
        marketAccountPosition.longInvalidation.minus(toPosition.invalidation.long),
      )
      marketAccountPosition.short = toPosition.short.plus(
        marketAccountPosition.shortInvalidation.minus(toPosition.invalidation.short),
      )

      const toMagnitude = magnitude(
        marketAccountPosition.maker,
        marketAccountPosition.long,
        marketAccountPosition.short,
      )

      // Add to close size and notional before checkpointing
      if (toMagnitude.lt(currentMagnitude)) {
        const delta = toMagnitude.minus(currentMagnitude).abs()
        marketAccountPosition.closeSize = marketAccountPosition.closeSize.plus(delta)
        notionalVolume = mul(delta, getOrCreateMarketVersionPrice(market, version).abs())
        marketAccountPosition.closeNotional = marketAccountPosition.closeNotional.plus(notionalVolume)
        marketAccountPosition.closePriceImpactFees = marketAccountPosition.closePriceImpactFees.plus(
          positionPrcessedEntity.priceImpactFee,
        )
      }

      if (currentMagnitude.equals(BigInt.zero()) && toMagnitude.gt(BigInt.zero())) {
        const checkpointId = marketAccountPosition.id.concat(':').concat(version.toString())
        const checkpoint = new MarketAccountCheckpoint(checkpointId)
        checkpoint.merge([marketAccountPosition])
        checkpoint.id = checkpointId
        checkpoint.version = version
        checkpoint.type = 'open'
        checkpoint.blockNumber = event.block.number
        checkpoint.blockTimestamp = event.block.timestamp
        checkpoint.transactionHash = event.transaction.hash
        checkpoint.side = side(marketAccountPosition.maker, marketAccountPosition.long, marketAccountPosition.short)
        checkpoint.startMagnitude = magnitude(
          marketAccountPosition.maker,
          marketAccountPosition.long,
          marketAccountPosition.short,
        )
        checkpoint.update = updatedId(market, account, version)
        checkpoint.save()
      }
      if (currentMagnitude.gt(BigInt.zero()) && toMagnitude.equals(BigInt.zero())) {
        const checkpointId = marketAccountPosition.id.concat(':').concat(version.toString())
        const checkpoint = new MarketAccountCheckpoint(checkpointId)
        checkpoint.merge([marketAccountPosition])
        checkpoint.id = checkpointId
        checkpoint.version = version
        checkpoint.type = 'close'
        checkpoint.blockNumber = event.block.number
        checkpoint.blockTimestamp = event.block.timestamp
        checkpoint.transactionHash = event.transaction.hash
        checkpoint.side = currentSide // Use current side since the new side is zero
        checkpoint.startMagnitude = BigInt.zero()
        checkpoint.update = updatedId(market, account, version)
        checkpoint.save()
      }

      // Add to open size and notional after checkpointing
      if (toMagnitude.gt(currentMagnitude)) {
        marketAccountPosition.openSize = marketAccountPosition.openSize.plus(toMagnitude.minus(currentMagnitude))
        notionalVolume = mul(toMagnitude.minus(currentMagnitude), getOrCreateMarketVersionPrice(market, version).abs())
        marketAccountPosition.openNotional = marketAccountPosition.openNotional.plus(notionalVolume)
        marketAccountPosition.openPriceImpactFees = marketAccountPosition.openPriceImpactFees.plus(
          positionPrcessedEntity.priceImpactFee,
        )
      }
    }

    // If invalid, increment invalidations
    if (!toVersionData.valid) {
      marketAccountPosition.makerInvalidation = toPosition.invalidation.maker.plus(
        marketAccountPosition.maker.minus(toPosition.maker),
      )
      marketAccountPosition.longInvalidation = toPosition.invalidation.long.plus(
        marketAccountPosition.long.minus(toPosition.long),
      )
      marketAccountPosition.shortInvalidation = toPosition.invalidation.short.plus(
        marketAccountPosition.short.minus(toPosition.short),
      )
    }
  }

  // Update the latest timestamps
  marketAccountPosition.lastUpdatedBlockNumber = event.block.number
  marketAccountPosition.lastUpdatedBlockTimestamp = event.block.timestamp
  marketAccountPosition.lastUpdatedVersion = version

  // NOTE: we specifically don't update netDeposits here because those are handled in
  // the UPDATE event as they settle immediately

  // Save updates
  marketAccountPosition.save()

  const newSide = side(marketAccountPosition.maker, marketAccountPosition.long, marketAccountPosition.short)
  if (currentSide !== 'none') updateAccountGlobalAccumulator(event, positionPrcessedEntity, currentSide, notionalVolume)
  else updateAccountGlobalAccumulator(event, positionPrcessedEntity, newSide, notionalVolume)
}

function positionProcessedID(market: Address, fromOracleVersion: BigInt): string {
  return market
    .toHexString()
    .concat(':')
    .concat(fromOracleVersion.toString())
}
export function handlePositionProcessed(event: PositionProcessedEvent): void {
  let entity = new PositionProcessed(positionProcessedID(event.address, event.params.fromOracleVersion))
  entity.market = event.address

  entity.fromOracleVersion = event.params.fromOracleVersion
  entity.toOracleVersion = event.params.toOracleVersion
  entity.fromPosition = event.params.fromPosition
  entity.toPosition = event.params.toPosition
  entity.accumulationResult_positionFeeMaker = event.params.accumulationResult.positionFeeMaker
  entity.accumulationResult_positionFeeFee = event.params.accumulationResult.positionFeeFee
  entity.accumulationResult_fundingMaker = event.params.accumulationResult.fundingMaker
  entity.accumulationResult_fundingLong = event.params.accumulationResult.fundingLong
  entity.accumulationResult_fundingShort = event.params.accumulationResult.fundingShort
  entity.accumulationResult_fundingFee = event.params.accumulationResult.fundingFee
  entity.accumulationResult_interestMaker = event.params.accumulationResult.interestMaker
  entity.accumulationResult_interestLong = event.params.accumulationResult.interestLong
  entity.accumulationResult_interestShort = event.params.accumulationResult.interestShort
  entity.accumulationResult_interestFee = event.params.accumulationResult.interestFee
  entity.accumulationResult_pnlMaker = event.params.accumulationResult.pnlMaker
  entity.accumulationResult_pnlLong = event.params.accumulationResult.pnlLong
  entity.accumulationResult_pnlShort = event.params.accumulationResult.pnlShort
  entity.accumulationResult_rewardMaker = event.params.accumulationResult.rewardMaker
  entity.accumulationResult_rewardLong = event.params.accumulationResult.rewardLong
  entity.accumulationResult_rewardShort = event.params.accumulationResult.rewardShort

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  const marketContract = Market.bind(event.address)
  const toVersionData = marketContract.versions(event.params.toOracleVersion)
  if (toVersionData.valid) {
    entity.toVersionValid = true
    entity.toVersionPrice = getOrCreateMarketVersionPrice(event.address, event.params.toOracleVersion)
  } else {
    entity.toVersionValid = false
    entity.toVersionPrice = BigInt.zero()
  }

  const marketGlobalPosition = getOrCreateMarketGlobalPosition(event.address)
  entity.fromMaker = marketGlobalPosition.maker
  entity.fromLong = marketGlobalPosition.long
  entity.fromShort = marketGlobalPosition.short
  entity.fromVersionPrice = getOrCreateMarketVersionPrice(event.address, marketGlobalPosition.timestamp)

  entity.save()

  // Update maker accumulator before transition global position
  updateMarketAccumulator(event)

  let makerDelta = BigInt.zero()
  let longDelta = BigInt.zero()
  let shortDelta = BigInt.zero()

  // If the toVersion is valid, then we need to update the global position
  if (event.params.fromPosition.lt(event.params.toPosition)) {
    let toPosition = marketContract.pendingPosition(event.params.toPosition)

    // adjust the position
    if (toVersionData.valid) {
      const nextMaker = toPosition.maker.plus(
        marketGlobalPosition.makerInvalidation.minus(toPosition.invalidation.maker),
      )
      const nextLong = toPosition.long.plus(marketGlobalPosition.longInvalidation.minus(toPosition.invalidation.long))
      const nextShort = toPosition.short.plus(
        marketGlobalPosition.shortInvalidation.minus(toPosition.invalidation.short),
      )

      makerDelta = nextMaker.minus(marketGlobalPosition.maker)
      longDelta = nextLong.minus(marketGlobalPosition.long)
      shortDelta = nextShort.minus(marketGlobalPosition.short)

      marketGlobalPosition.maker = nextMaker
      marketGlobalPosition.long = nextLong
      marketGlobalPosition.short = nextShort
    }

    if (!toVersionData.valid) {
      marketGlobalPosition.makerInvalidation = toPosition.invalidation.maker.plus(
        marketGlobalPosition.maker.minus(toPosition.maker),
      )
      marketGlobalPosition.longInvalidation = toPosition.invalidation.long.plus(
        marketGlobalPosition.long.minus(toPosition.long),
      )
      marketGlobalPosition.shortInvalidation = toPosition.invalidation.short.plus(
        marketGlobalPosition.short.minus(toPosition.short),
      )
    }

    marketGlobalPosition.timestamp = event.params.toOracleVersion
    marketGlobalPosition.save()
  }

  updateBucketedVolumes(
    entity,
    event,
    entity.fromVersionPrice,
    entity.fromMaker,
    entity.fromLong,
    entity.fromShort,
    makerDelta,
    longDelta,
    shortDelta,
  )
}

function getOrCreateMarketVersionPrice(market: Address, version: BigInt): BigInt {
  const id = market
    .toHexString()
    .concat(':')
    .concat(version.toString())
  let marketVersionPrice = MarketVersionPrice.load(id)
  if (marketVersionPrice === null) {
    marketVersionPrice = new MarketVersionPrice(id)
    marketVersionPrice.market = market
    marketVersionPrice.version = version
    marketVersionPrice.price = price(market, version)
    marketVersionPrice.save()
  }

  return marketVersionPrice.price
}

function marketAccumulatorId(market: Address, version: BigInt): string {
  return market
    .toHexString()
    .concat(':')
    .concat(version.toString())
}
function updateMarketAccumulator(event: PositionProcessedEvent): void {
  const marketContract = Market.bind(event.address)
  const fromPosition = getOrCreateMarketGlobalPosition(event.address)

  const version = marketContract.versions(event.params.toOracleVersion)

  let entity = new MarketAccumulator(marketAccumulatorId(event.address, event.params.toOracleVersion))

  entity.latest = false
  entity.market = event.address
  entity.version = event.params.toOracleVersion
  entity.positionId = event.params.fromPosition
  entity.positionMaker = fromPosition.maker
  entity.positionLong = fromPosition.long
  entity.positionShort = fromPosition.short

  entity.makerValue = version.makerValue._value
  entity.longValue = version.longValue._value
  entity.shortValue = version.shortValue._value
  entity.makerReward = version.makerReward._value
  entity.longReward = version.longReward._value
  entity.shortReward = version.shortReward._value

  // Get the last accumulator
  const latestId = event.address.toHexString().concat(':latest')
  let lastAccumulator = MarketAccumulator.load(latestId)

  // Accumulate the values
  entity.pnlMaker = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.pnlMaker,
    event.params.accumulationResult.pnlMaker,
    fromPosition.maker,
  )
  entity.pnlLong = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.pnlLong,
    event.params.accumulationResult.pnlLong,
    fromPosition.long,
  )
  entity.pnlShort = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.pnlShort,
    event.params.accumulationResult.pnlShort,
    fromPosition.short,
  )
  entity.fundingMaker = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.fundingMaker,
    event.params.accumulationResult.fundingMaker,
    fromPosition.maker,
  )
  entity.fundingLong = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.fundingLong,
    event.params.accumulationResult.fundingLong,
    fromPosition.long,
  )
  entity.fundingShort = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.fundingShort,
    event.params.accumulationResult.fundingShort,
    fromPosition.short,
  )
  entity.interestMaker = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.interestMaker,
    event.params.accumulationResult.interestMaker,
    fromPosition.maker,
  )
  entity.interestLong = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.interestLong,
    event.params.accumulationResult.interestLong,
    fromPosition.long,
  )
  entity.interestShort = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.interestShort,
    event.params.accumulationResult.interestShort,
    fromPosition.short,
  )
  entity.positionFeeMaker = accumulatorIncrement(
    lastAccumulator === null ? BigInt.zero() : lastAccumulator.positionFeeMaker,
    event.params.accumulationResult.positionFeeMaker,
    fromPosition.maker,
  )

  // save and save as latest
  entity.save()
  if (lastAccumulator === null) {
    lastAccumulator = new MarketAccumulator(latestId)
  }
  lastAccumulator.merge([entity])
  lastAccumulator.id = latestId
  lastAccumulator.latest = true
  lastAccumulator.save()
}

function updatedId(market: Address, account: Address, version: BigInt): string {
  return market
    .toHexString()
    .concat(':')
    .concat(account.toHexString())
    .concat(':')
    .concat(version.toString())
}
export function handleUpdated(event: UpdatedEvent): void {
  const id = updatedId(event.address, event.params.account, event.params.version)
  let entity = Updated.load(id)
  if (entity === null) {
    entity = new Updated(id)
    entity.collateral = BigInt.zero()
    entity.interfaceFee = BigInt.zero()
    entity.orderFee = BigInt.zero()
  }
  const market = Market.bind(event.address)

  entity.market = event.address
  entity.sender = event.params.sender
  entity.account = event.params.account
  entity.version = event.params.version
  entity.newMaker = event.params.newMaker
  entity.newLong = event.params.newLong
  entity.newShort = event.params.newShort
  entity.collateral = entity.collateral.plus(event.params.collateral) // Collaterals are deltas, so future updates for the same version will add to this
  entity.protect = event.params.protect
  entity.liquidationFee = BigInt.zero()
  if (entity.protect) {
    const local = market.try_locals(event.params.account)
    if (!local.reverted) entity.liquidationFee = local.value.protectionAmount
  }

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  const global = market.global()
  const local = market.locals(event.params.account)
  const pendingPosition = market.pendingPositions(event.params.account, local.currentId)
  const latestPosition = getOrCreateMarketAccountPosition(
    event.address,
    event.params.account,
    event.block.number,
    event.block.timestamp,
    event.params.version,
  )

  entity.globalPositionId = global.currentId
  entity.localPositionId = local.currentId
  entity.valid = false
  entity.price = BigInt.zero()
  // Optimistic delta update based on pending position and invalidation
  const fromSide = side(latestPosition.maker, latestPosition.long, latestPosition.short)
  const fromMagnitude = magnitude(
    pendingPosition.maker.plus(latestPosition.makerInvalidation.minus(pendingPosition.invalidation.maker)),
    pendingPosition.long.plus(latestPosition.longInvalidation.minus(pendingPosition.invalidation.long)),
    pendingPosition.short.plus(latestPosition.shortInvalidation.minus(pendingPosition.invalidation.short)),
  )
  entity.delta = magnitude(entity.newMaker, entity.newLong, entity.newShort).minus(fromMagnitude)
  // Set side as previous side or new side (if previous side is none)
  if (fromSide !== 'none') entity.side = fromSide
  else entity.side = side(entity.newMaker, entity.newLong, entity.newShort)

  entity.latestPrice = latestPrice(event.address) // Price at time of update, used for fee calcs
  entity.positionFee = pendingPosition.fee
  entity.priceImpactFee = BigInt.zero()
  const receipt = event.receipt
  let interfaceFee = BigInt.zero()
  if (receipt != null) {
    let orderFee = BigInt.zero()
    // TODO: how do we handle if multiple interface fees are charged in one tx
    for (let i = 0; i < receipt.logs.length; i++) {
      const log = receipt.logs[i]
      if (log.topics[0].equals(INTERFACE_FEE_TOPIC_21)) {
        const decoded = ethereum.decode('(uint256,address,bool)', log.data)
        if (decoded) {
          const feeAmount = decoded.toTuple()[0].toBigInt()
          // If the fee is equal to the collateral withdrawal, then it is an interface fee
          if (feeAmount.equals(event.params.collateral.times(BigInt.fromI32(-1)))) {
            interfaceFee = interfaceFee.plus(feeAmount)
          }
        }
      }

      if (log.topics[0].equals(ORDER_FEE_TOPIC)) {
        const decoded = ethereum.decode('(uint256,uint256,uint256,uint256,uint256)', log.data)
        if (decoded) {
          const feeAmount = fromBig18(decoded.toTuple()[4].toBigInt(), true)
          // If the fee is equal to the collateral withdrawal, then it is an order fee
          if (feeAmount.equals(event.params.collateral.times(BigInt.fromI32(-1)))) {
            orderFee = feeAmount
          }
        }
      }
    }
    entity.interfaceFee = entity.interfaceFee.plus(interfaceFee)
    entity.orderFee = entity.orderFee.plus(orderFee)
  }

  entity.save()

  // update latest position net deposits, collateral, and pending values
  // All other fields are updated after settlement occurs
  latestPosition.netDeposits = latestPosition.netDeposits.plus(event.params.collateral)
  latestPosition.collateral = latestPosition.collateral.plus(event.params.collateral)
  latestPosition.accumulatedInterfaceFees = latestPosition.accumulatedInterfaceFees.plus(interfaceFee)
  latestPosition.accumulatedOrderFees = latestPosition.accumulatedOrderFees.plus(entity.orderFee)
  latestPosition.pendingMaker = event.params.newMaker
  latestPosition.pendingLong = event.params.newLong
  latestPosition.pendingShort = event.params.newShort
  latestPosition.save()

  const accountGlobalAccumulator = getOrCreateAccountGlobalAccumulator(
    event.params.account,
    event.block.number,
    event.block.timestamp,
    event.params.version,
  )
  accountGlobalAccumulator.netDeposits = accountGlobalAccumulator.netDeposits.plus(event.params.collateral)
  accountGlobalAccumulator.save()

  const globalLatestPosition = getOrCreateMarketGlobalPosition(event.address)
  const globalPending = market.pendingPosition(global.currentId)
  globalLatestPosition.pendingMaker = globalPending.maker
  globalLatestPosition.pendingLong = globalPending.long
  globalLatestPosition.pendingShort = globalPending.short
  globalLatestPosition.save()
}

export function handleOrderCreated(event: OrderCreatedEvent): void {
  const id = event.transaction.hash
    .concat(event.address)
    .concatI32(event.transactionLogIndex.toI32())
    .concatI32(event.logIndex.toI32())
  const entity = new OrderCreated(id)
  const marketContract = Market.bind(event.address)

  entity.market = event.address
  entity.account = event.params.account
  entity.version = event.params.version
  entity.update = updatedId(event.address, event.params.account, event.params.version)

  entity.order_maker = event.params.order.maker
  entity.order_long = event.params.order.long
  entity.order_short = event.params.order.short
  entity.order_net = event.params.order.net
  entity.order_skew = event.params.order.skew
  entity.order_impact = event.params.order.impact
  entity.order_utilization = event.params.order.utilization
  entity.order_efficiency = event.params.order.efficiency
  entity.order_fee = event.params.order.fee
  entity.order_keeper = event.params.order.keeper
  entity.collateral = event.params.collateral

  entity.priceImpactFee = entity.order_fee.minus(mul(marketContract.parameter().positionFee, entity.order_fee))

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

function latestMarketAccountPositionId(market: Address, account: Address): string {
  return market
    .toHexString()
    .concat(':')
    .concat(account.toHexString())
}
function getOrCreateMarketAccountPosition(
  market: Address,
  account: Address,
  blockNumber: BigInt,
  timestamp: BigInt,
  version: BigInt,
): MarketAccountPosition {
  const id = latestMarketAccountPositionId(market, account)
  let marketAccountPosition = MarketAccountPosition.load(id)
  if (marketAccountPosition === null) {
    marketAccountPosition = new MarketAccountPosition(latestMarketAccountPositionId(market, account))
    marketAccountPosition.market = market
    marketAccountPosition.account = account

    marketAccountPosition.maker = BigInt.zero()
    marketAccountPosition.long = BigInt.zero()
    marketAccountPosition.short = BigInt.zero()
    marketAccountPosition.pendingMaker = BigInt.zero()
    marketAccountPosition.pendingLong = BigInt.zero()
    marketAccountPosition.pendingShort = BigInt.zero()
    marketAccountPosition.collateral = BigInt.zero()
    marketAccountPosition.makerInvalidation = BigInt.zero()
    marketAccountPosition.longInvalidation = BigInt.zero()
    marketAccountPosition.shortInvalidation = BigInt.zero()

    marketAccountPosition.netDeposits = BigInt.zero()
    marketAccountPosition.accumulatedPnl = BigInt.zero()
    marketAccountPosition.accumulatedFunding = BigInt.zero()
    marketAccountPosition.accumulatedInterest = BigInt.zero()
    marketAccountPosition.accumulatedMakerPositionFee = BigInt.zero()
    marketAccountPosition.accumulatedValue = BigInt.zero()
    marketAccountPosition.accumulatedReward = BigInt.zero()
    marketAccountPosition.accumulatedCollateral = BigInt.zero()
    marketAccountPosition.accumulatedPositionFees = BigInt.zero()
    marketAccountPosition.accumulatedPriceImpactFees = BigInt.zero()
    marketAccountPosition.accumulatedKeeperFees = BigInt.zero()
    marketAccountPosition.accumulatedInterfaceFees = BigInt.zero()
    marketAccountPosition.accumulatedOrderFees = BigInt.zero()

    marketAccountPosition.openSize = BigInt.zero()
    marketAccountPosition.openNotional = BigInt.zero()
    marketAccountPosition.openPriceImpactFees = BigInt.zero()
    marketAccountPosition.closeSize = BigInt.zero()
    marketAccountPosition.closeNotional = BigInt.zero()
    marketAccountPosition.closePriceImpactFees = BigInt.zero()
    marketAccountPosition.weightedFunding = BigInt.zero()
    marketAccountPosition.weightedInterest = BigInt.zero()
    marketAccountPosition.weightedMakerPositionFees = BigInt.zero()
    marketAccountPosition.totalWeight = BigInt.zero()

    marketAccountPosition.lastUpdatedBlockNumber = blockNumber
    marketAccountPosition.lastUpdatedBlockTimestamp = timestamp
    marketAccountPosition.lastUpdatedVersion = version
    marketAccountPosition.save()
  }

  return marketAccountPosition
}

function updateAccountGlobalAccumulator(
  event: AccountPositionProcessedEvent,
  positionPrcessedEntity: AccountPositionProcessed,
  currentSide: string,
  notionalVolume: BigInt,
): void {
  const entity = getOrCreateAccountGlobalAccumulator(
    event.params.account,
    event.block.number,
    event.block.timestamp,
    event.params.fromOracleVersion,
  )
  if (currentSide === 'maker') {
    entity.accumulatedMakerPnl = entity.accumulatedMakerPnl.plus(positionPrcessedEntity.accumulatedPnl)
    entity.accumulatedMakerFunding = entity.accumulatedMakerFunding.plus(positionPrcessedEntity.accumulatedFunding)
    entity.accumulatedMakerInterest = entity.accumulatedMakerInterest.plus(positionPrcessedEntity.accumulatedInterest)
    entity.accumulatedMakerPositionFee = entity.accumulatedMakerPositionFee.plus(
      positionPrcessedEntity.accumulatedMakerPositionFee,
    )
    entity.accumulatedMakerValue = entity.accumulatedMakerValue.plus(positionPrcessedEntity.accumulatedValue)
    entity.accumulatedMakerReward = entity.accumulatedMakerReward.plus(positionPrcessedEntity.accumulatedReward)
    entity.accumulatedMakerCollateral = entity.accumulatedMakerCollateral.plus(
      positionPrcessedEntity.accumulationResult_collateralAmount,
    )
  } else if (currentSide === 'long') {
    entity.accumulatedLongPnl = entity.accumulatedLongPnl.plus(positionPrcessedEntity.accumulatedPnl)
    entity.accumulatedLongFunding = entity.accumulatedLongFunding.plus(positionPrcessedEntity.accumulatedFunding)
    entity.accumulatedLongInterest = entity.accumulatedLongInterest.plus(positionPrcessedEntity.accumulatedInterest)
    entity.accumulatedLongValue = entity.accumulatedLongValue.plus(positionPrcessedEntity.accumulatedValue)
    entity.accumulatedLongReward = entity.accumulatedLongReward.plus(positionPrcessedEntity.accumulatedReward)
    entity.accumulatedLongCollateral = entity.accumulatedLongCollateral.plus(
      positionPrcessedEntity.accumulationResult_collateralAmount,
    )
    entity.longNotionalVolume = entity.longNotionalVolume.plus(notionalVolume)
    if (notionalVolume.notEqual(BigInt.zero())) entity.longTrades = entity.longTrades.plus(BigInt.fromI32(1))
  } else if (currentSide === 'short') {
    entity.accumulatedShortPnl = entity.accumulatedShortPnl.plus(positionPrcessedEntity.accumulatedPnl)
    entity.accumulatedShortFunding = entity.accumulatedShortFunding.plus(positionPrcessedEntity.accumulatedFunding)
    entity.accumulatedShortInterest = entity.accumulatedShortInterest.plus(positionPrcessedEntity.accumulatedInterest)
    entity.accumulatedShortValue = entity.accumulatedShortValue.plus(positionPrcessedEntity.accumulatedValue)
    entity.accumulatedShortReward = entity.accumulatedShortReward.plus(positionPrcessedEntity.accumulatedReward)
    entity.accumulatedShortCollateral = entity.accumulatedShortCollateral.plus(
      positionPrcessedEntity.accumulationResult_collateralAmount,
    )
    entity.shortNotionalVolume = entity.shortNotionalVolume.plus(notionalVolume)
    if (notionalVolume.notEqual(BigInt.zero())) entity.shortTrades = entity.shortTrades.plus(BigInt.fromI32(1))
  }

  if (currentSide === 'long' || currentSide === 'short') {
    entity.accumulatedTakerPnl = entity.accumulatedTakerPnl.plus(positionPrcessedEntity.accumulatedPnl)
    entity.accumulatedTakerFunding = entity.accumulatedTakerFunding.plus(positionPrcessedEntity.accumulatedFunding)
    entity.accumulatedTakerInterest = entity.accumulatedTakerInterest.plus(positionPrcessedEntity.accumulatedInterest)
    entity.accumulatedTakerValue = entity.accumulatedTakerValue.plus(positionPrcessedEntity.accumulatedValue)
    entity.accumulatedTakerReward = entity.accumulatedTakerReward.plus(positionPrcessedEntity.accumulatedReward)
    entity.accumulatedTakerCollateral = entity.accumulatedTakerCollateral.plus(
      positionPrcessedEntity.accumulationResult_collateralAmount,
    )
    entity.takerNotionalVolume = entity.takerNotionalVolume.plus(notionalVolume)
    if (notionalVolume.notEqual(BigInt.zero())) entity.takerTrades = entity.takerTrades.plus(BigInt.fromI32(1))
  }

  entity.lastUpdatedBlockNumber = event.block.number
  entity.lastUpdatedBlockTimestamp = event.block.timestamp
  entity.lastUpdatedVersion = event.params.fromOracleVersion

  entity.save()
}
function getOrCreateAccountGlobalAccumulator(
  account: Address,
  blockNumber: BigInt,
  timestamp: BigInt,
  version: BigInt,
): AccountGlobalAccumulator {
  let accountGlobalAccumulator = AccountGlobalAccumulator.load(account.toHexString())
  if (accountGlobalAccumulator === null) {
    accountGlobalAccumulator = new AccountGlobalAccumulator(account.toHexString())
    accountGlobalAccumulator.account = account

    accountGlobalAccumulator.accumulatedMakerPnl = BigInt.zero()
    accountGlobalAccumulator.accumulatedMakerFunding = BigInt.zero()
    accountGlobalAccumulator.accumulatedMakerInterest = BigInt.zero()
    accountGlobalAccumulator.accumulatedMakerPositionFee = BigInt.zero()
    accountGlobalAccumulator.accumulatedMakerValue = BigInt.zero()
    accountGlobalAccumulator.accumulatedMakerReward = BigInt.zero()
    accountGlobalAccumulator.accumulatedMakerCollateral = BigInt.zero()

    accountGlobalAccumulator.accumulatedLongPnl = BigInt.zero()
    accountGlobalAccumulator.accumulatedLongFunding = BigInt.zero()
    accountGlobalAccumulator.accumulatedLongInterest = BigInt.zero()
    accountGlobalAccumulator.accumulatedLongValue = BigInt.zero()
    accountGlobalAccumulator.accumulatedLongReward = BigInt.zero()
    accountGlobalAccumulator.accumulatedLongCollateral = BigInt.zero()
    accountGlobalAccumulator.longNotionalVolume = BigInt.zero()
    accountGlobalAccumulator.longTrades = BigInt.zero()

    accountGlobalAccumulator.accumulatedShortPnl = BigInt.zero()
    accountGlobalAccumulator.accumulatedShortFunding = BigInt.zero()
    accountGlobalAccumulator.accumulatedShortInterest = BigInt.zero()
    accountGlobalAccumulator.accumulatedShortValue = BigInt.zero()
    accountGlobalAccumulator.accumulatedShortReward = BigInt.zero()
    accountGlobalAccumulator.accumulatedShortCollateral = BigInt.zero()
    accountGlobalAccumulator.shortNotionalVolume = BigInt.zero()
    accountGlobalAccumulator.shortTrades = BigInt.zero()

    accountGlobalAccumulator.accumulatedTakerPnl = BigInt.zero()
    accountGlobalAccumulator.accumulatedTakerFunding = BigInt.zero()
    accountGlobalAccumulator.accumulatedTakerInterest = BigInt.zero()
    accountGlobalAccumulator.accumulatedTakerValue = BigInt.zero()
    accountGlobalAccumulator.accumulatedTakerReward = BigInt.zero()
    accountGlobalAccumulator.accumulatedTakerCollateral = BigInt.zero()
    accountGlobalAccumulator.takerNotionalVolume = BigInt.zero()
    accountGlobalAccumulator.takerTrades = BigInt.zero()

    accountGlobalAccumulator.netDeposits = BigInt.zero()

    accountGlobalAccumulator.lastUpdatedVersion = version
    accountGlobalAccumulator.lastUpdatedBlockNumber = blockNumber
    accountGlobalAccumulator.lastUpdatedBlockTimestamp = timestamp
    accountGlobalAccumulator.save()
  }

  return accountGlobalAccumulator
}

function getOrCreateMarketGlobalPosition(market: Address): MarketGlobalPosition {
  const id = market.toHexString()
  let marketGlobalPosition = MarketGlobalPosition.load(id)
  if (marketGlobalPosition === null) {
    marketGlobalPosition = new MarketGlobalPosition(id)
    marketGlobalPosition.market = market
    marketGlobalPosition.timestamp = BigInt.zero()
    marketGlobalPosition.maker = BigInt.zero()
    marketGlobalPosition.long = BigInt.zero()
    marketGlobalPosition.short = BigInt.zero()
    marketGlobalPosition.pendingMaker = BigInt.zero()
    marketGlobalPosition.pendingLong = BigInt.zero()
    marketGlobalPosition.pendingShort = BigInt.zero()
    marketGlobalPosition.makerInvalidation = BigInt.zero()
    marketGlobalPosition.longInvalidation = BigInt.zero()
    marketGlobalPosition.shortInvalidation = BigInt.zero()
  }

  return marketGlobalPosition
}

/*

      PARAM UPDATES

*/

export function handleBeneficiaryUpdated(event: BeneficiaryUpdatedEvent): void {
  let entity = new BeneficiaryUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.newBeneficiary = event.params.newBeneficiary

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleCoordinatorUpdated(event: CoordinatorUpdatedEvent): void {
  let entity = new CoordinatorUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.newCoordinator = event.params.newCoordinator

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFeeClaimed(event: FeeClaimedEvent): void {
  let entity = new FeeClaimed(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.account = event.params.account
  entity.amount = event.params.amount

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleInitialized(event: InitializedEvent): void {
  let entity = new MarketInitialized(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleRiskParameterUpdated(event: RiskParameterUpdatedEvent): void {
  let entity = new RiskParameterUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.newRiskParameter_margin = event.params.newRiskParameter.margin
  entity.newRiskParameter_maintenance = event.params.newRiskParameter.maintenance
  entity.newRiskParameter_takerFee = event.params.newRiskParameter.takerFee
  entity.newRiskParameter_takerSkewFee = event.params.newRiskParameter.takerSkewFee
  entity.newRiskParameter_takerImpactFee = event.params.newRiskParameter.takerImpactFee
  entity.newRiskParameter_makerFee = event.params.newRiskParameter.makerFee
  entity.newRiskParameter_makerImpactFee = event.params.newRiskParameter.makerImpactFee
  entity.newRiskParameter_makerLimit = event.params.newRiskParameter.makerLimit
  entity.newRiskParameter_efficiencyLimit = event.params.newRiskParameter.efficiencyLimit
  entity.newRiskParameter_liquidationFee = event.params.newRiskParameter.liquidationFee
  entity.newRiskParameter_minLiquidationFee = event.params.newRiskParameter.minLiquidationFee
  entity.newRiskParameter_maxLiquidationFee = event.params.newRiskParameter.maxLiquidationFee
  entity.newRiskParameter_utilizationCurve_minRate = event.params.newRiskParameter.utilizationCurve.minRate
  entity.newRiskParameter_utilizationCurve_maxRate = event.params.newRiskParameter.utilizationCurve.maxRate
  entity.newRiskParameter_utilizationCurve_targetRate = event.params.newRiskParameter.utilizationCurve.targetRate
  entity.newRiskParameter_utilizationCurve_targetUtilization =
    event.params.newRiskParameter.utilizationCurve.targetUtilization
  entity.newRiskParameter_pController_k = event.params.newRiskParameter.pController.k
  entity.newRiskParameter_pController_max = event.params.newRiskParameter.pController.max
  entity.newRiskParameter_minMargin = event.params.newRiskParameter.minMargin
  entity.newRiskParameter_minMaintenance = event.params.newRiskParameter.minMaintenance
  entity.newRiskParameter_virtualTaker = BigInt.zero()
  entity.newRiskParameter_skewScale = event.params.newRiskParameter.skewScale
  entity.newRiskParameter_staleAfter = event.params.newRiskParameter.staleAfter
  entity.newRiskParameter_makerReceiveOnly = event.params.newRiskParameter.makerReceiveOnly

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleParameterUpdated(event: ParameterUpdatedEvent): void {
  let entity = new MarketParameterUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.address
  entity.newParameter_fundingFee = event.params.newParameter.fundingFee
  entity.newParameter_interestFee = event.params.newParameter.interestFee
  entity.newParameter_positionFee = event.params.newParameter.positionFee
  entity.newParameter_oracleFee = event.params.newParameter.oracleFee
  entity.newParameter_riskFee = event.params.newParameter.riskFee
  entity.newParameter_maxPendingGlobal = event.params.newParameter.maxPendingGlobal
  entity.newParameter_maxPendingLocal = event.params.newParameter.maxPendingLocal
  entity.newParameter_makerRewardRate = event.params.newParameter.makerRewardRate
  entity.newParameter_longRewardRate = event.params.newParameter.longRewardRate
  entity.newParameter_shortRewardRate = event.params.newParameter.shortRewardRate
  entity.newParameter_settlementFee = event.params.newParameter.settlementFee
  entity.newParameter_takerCloseAlways = event.params.newParameter.takerCloseAlways
  entity.newParameter_makerCloseAlways = event.params.newParameter.makerCloseAlways
  entity.newParameter_closed = event.params.newParameter.closed

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
