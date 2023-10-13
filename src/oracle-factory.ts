import {
  CallerAuthorized as CallerAuthorizedEvent,
  FactoryRegistered as FactoryRegisteredEvent,
  Initialized as InitializedEvent,
  InstanceRegistered as InstanceRegisteredEvent,
  MaxClaimUpdated as MaxClaimUpdatedEvent,
  OracleCreated as OracleCreatedEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  Paused as PausedEvent,
  PauserUpdated as PauserUpdatedEvent,
  PendingOwnerUpdated as PendingOwnerUpdatedEvent,
  Unpaused as UnpausedEvent,
} from '../generated/OracleFactory/OracleFactory'
import {
  CallerAuthorized,
  FactoryRegistered,
  Initialized,
  InstanceRegistered,
  MaxClaimUpdated,
  OracleCreated,
  OwnerUpdated,
  Paused,
  PauserUpdated,
  PendingOwnerUpdated,
  Unpaused,
} from '../generated/schema'

export function handleCallerAuthorized(event: CallerAuthorizedEvent): void {
  let entity = new CallerAuthorized(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.caller = event.params.caller

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleFactoryRegistered(event: FactoryRegisteredEvent): void {
  let entity = new FactoryRegistered(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.factory = event.params.factory

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

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
}

export function handleMaxClaimUpdated(event: MaxClaimUpdatedEvent): void {
  let entity = new MaxClaimUpdated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.newMaxClaim = event.params.newMaxClaim

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOracleCreated(event: OracleCreatedEvent): void {
  let entity = new OracleCreated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.oracle = event.params.oracle
  entity.OracleFactory_id = event.params.id

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
