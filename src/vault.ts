import {
  Initialized as InitializedEvent,
  MarketRegistered as MarketRegisteredEvent,
  MarketUpdated as MarketUpdatedEvent,
  ParameterUpdated as ParameterUpdatedEvent,
  Updated as UpdatedEvent,
} from '../generated/templates/Vault/Vault'
import {
  Initialized,
  VaultMarketRegistered,
  VaultMarketUpdated,
  VaultParameterUpdated,
  VaultUpdated,
} from '../generated/schema'

export function handleInitialized(event: InitializedEvent): void {
  let entity = new Initialized(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMarketRegistered(event: MarketRegisteredEvent): void {
  let entity = new VaultMarketRegistered(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.vault = event.address
  entity.marketId = event.params.marketId
  entity.market = event.params.market

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleMarketUpdated(event: MarketUpdatedEvent): void {
  let entity = new VaultMarketUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.vault = event.address
  entity.marketId = event.params.marketId
  entity.newWeight = event.params.newWeight
  entity.newLeverage = event.params.newLeverage

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleParameterUpdated(event: ParameterUpdatedEvent): void {
  let entity = new VaultParameterUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.vault = event.address
  entity.newParameter_cap = event.params.newParameter.cap

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUpdate(event: UpdatedEvent): void {
  let entity = new VaultUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.vault = event.address
  entity.sender = event.params.sender
  entity.account = event.params.account
  entity.version = event.params.version
  entity.depositAssets = event.params.depositAssets
  entity.redeemShares = event.params.redeemShares
  entity.claimAssets = event.params.claimAssets

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
