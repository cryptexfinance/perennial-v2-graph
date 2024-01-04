import {
  Initialized as InitializedEvent,
  KeeperCall as KeeperCallEvent,
  OracleProviderVersionFulfilled as OracleProviderVersionFulfilledEvent,
  OracleProviderVersionRequested as OracleProviderVersionRequestedEvent,
} from '../generated/templates/PythOracle/PythOracle'
import {
  PythOracleInitialized,
  PythOracleKeeperCall,
  OracleProviderVersionFulfilled,
  OracleProviderVersionRequested,
} from '../generated/schema'

export function handleInitialized(event: InitializedEvent): void {
  let entity = new PythOracleInitialized(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.address = event.address
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleKeeperCall(event: KeeperCallEvent): void {
  let entity = new PythOracleKeeperCall(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.address = event.address
  entity.sender = event.params.sender
  entity.gasUsed = event.params.gasUsed
  entity.multiplier = event.params.multiplier
  entity.buffer = event.params.buffer
  entity.keeperFee = event.params.keeperFee

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOracleProviderVersionFulfilled(event: OracleProviderVersionFulfilledEvent): void {
  let entity = new OracleProviderVersionFulfilled(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.address = event.address
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.keeper = event.transaction.from

  entity.save()
}

export function handleOracleProviderVersionRequested(event: OracleProviderVersionRequestedEvent): void {
  let entity = new OracleProviderVersionRequested(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.address = event.address
  entity.version = event.params.version

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}
