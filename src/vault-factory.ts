import { Vault } from '../generated/templates'
import {
  Initialized as InitializedEvent,
  InstanceRegistered as InstanceRegisteredEvent,
  OperatorUpdated as OperatorUpdatedEvent,
  OwnerUpdated as OwnerUpdatedEvent,
  Paused as PausedEvent,
  PauserUpdated as PauserUpdatedEvent,
  PendingOwnerUpdated as PendingOwnerUpdatedEvent,
  Unpaused as UnpausedEvent,
  VaultCreated as VaultCreatedEvent,
} from '../generated/VaultFactory/VaultFactory'
import {
  Initialized,
  InstanceRegistered,
  OperatorUpdated,
  OwnerUpdated,
  Paused,
  PauserUpdated,
  PendingOwnerUpdated,
  Unpaused,
  VaultCreated,
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

  // Create Vault
  Vault.create(event.params.instance)
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

export function handleVaultCreated(event: VaultCreatedEvent): void {
  let entity = new VaultCreated(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.vault = event.params.vault
  entity.asset = event.params.asset
  entity.initialMarket = event.params.initialMarket

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
