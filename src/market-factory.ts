import { Market } from '../generated/templates'
import {
  Initialized as InitializedEvent,
  InstanceRegistered as InstanceRegisteredEvent,
  MarketCreated as MarketCreatedEvent,
  OperatorUpdated as OperatorUpdatedEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  ParameterUpdated as ParameterUpdatedEvent,
  Paused as PausedEvent,
  PauserUpdated as PauserUpdatedEvent,
  PendingOwnerUpdated as PendingOwnerUpdatedEvent,
  Unpaused as UnpausedEvent,
} from '../generated/MarketFactory/MarketFactory'
import {
  Initialized,
  InstanceRegistered,
  MarketCreated,
  OperatorUpdated,
  OwnerUpdated,
  ParameterUpdated,
  Paused,
  PauserUpdated,
  PendingOwnerUpdated,
  Unpaused,
} from '../generated/schema'

export function handleInitialized(event: InitializedEvent): void {
  let entity = new Initialized(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleInstanceRegistered(event: InstanceRegisteredEvent): void {
  let entity = new InstanceRegistered(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.instance = event.params.instance

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  // Create Market
  Market.create(event.params.instance)
}

export function handleMarketCreated(event: MarketCreatedEvent): void {
  let entity = new MarketCreated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.market = event.params.market
  entity.definition_token = event.params.definition.token
  entity.definition_oracle = event.params.definition.oracle
  entity.definition_payoff = event.params.definition.payoff

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOperatorUpdated(event: OperatorUpdatedEvent): void {
  let entity = new OperatorUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.account = event.params.account
  entity.operator = event.params.operator
  entity.newEnabled = event.params.newEnabled

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOwnerUpdated(event: OwnerUpdatedEvent): void {
  let entity = new OwnerUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.newOwner = event.params.newOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleParameterUpdated(event: ParameterUpdatedEvent): void {
  let entity = new ParameterUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.newParameter_protocolFee = event.params.newParameter.protocolFee
  entity.newParameter_maxFee = event.params.newParameter.maxFee
  entity.newParameter_maxFeeAbsolute = event.params.newParameter.maxFeeAbsolute
  entity.newParameter_maxCut = event.params.newParameter.maxCut
  entity.newParameter_maxRate = event.params.newParameter.maxRate
  entity.newParameter_minMaintenance = event.params.newParameter.minMaintenance
  entity.newParameter_minEfficiency = event.params.newParameter.minEfficiency

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePaused(event: PausedEvent): void {
  let entity = new Paused(event.transaction.hash.concatI32(event.logIndex.toI32()))

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePauserUpdated(event: PauserUpdatedEvent): void {
  let entity = new PauserUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.newPauser = event.params.newPauser

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handlePendingOwnerUpdated(event: PendingOwnerUpdatedEvent): void {
  let entity = new PendingOwnerUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.newPendingOwner = event.params.newPendingOwner

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleUnpaused(event: UnpausedEvent): void {
  let entity = new Unpaused(event.transaction.hash.concatI32(event.logIndex.toI32()))

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
