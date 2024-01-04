import {
  Initialized as InitializedEvent,
  OracleProviderVersionFulfilled as OracleProviderVersionFulfilledEvent,
  OracleProviderVersionRequested as OracleProviderVersionRequestedEvent,
} from '../generated/templates/PythOracle/KeeperOracle'
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

export function handleOracleProviderVersionFulfilled(event: OracleProviderVersionFulfilledEvent): void {
  let entity = new OracleProviderVersionFulfilled(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.address = event.address
  entity.version = event.params.version.timestamp
  entity.valid = event.params.version.valid

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
