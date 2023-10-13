import { Address, BigInt, ByteArray, Bytes, crypto } from '@graphprotocol/graph-ts'
import {
  FeeCharged as FeeChargedEvent,
  Initialized as InitializedEvent,
  KeeperCall as KeeperCallEvent,
  KeeperFeeCharged as KeeperFeeChargedEvent,
  OrderCancelled as OrderCancelledEvent,
  OrderExecuted as OrderExecutedEvent,
  OrderPlaced as OrderPlacedEvent,
} from '../generated/MultiInvoker/MultiInvoker'
import {
  MultiInvokerFeeCharged,
  Initialized,
  MultiInvokerKeeperCall,
  MultiInvokerKeeperFeeCharged,
  MultiInvokerOrderCancelled,
  MultiInvokerOrderExecuted,
  MultiInvokerOrderPlaced,
} from '../generated/schema'

export function handleFeeCharged(event: FeeChargedEvent): void {
  let entity = new MultiInvokerFeeCharged(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.account = event.params.account
  entity.to = event.params.to
  entity.amount = event.params.amount

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

export function handleKeeperCall(event: KeeperCallEvent): void {
  let entity = new MultiInvokerKeeperCall(event.transaction.hash.concatI32(event.logIndex.toI32()))
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

export function handleKeeperFeeCharged(event: KeeperFeeChargedEvent): void {
  let entity = new MultiInvokerKeeperFeeCharged(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.account = event.params.account
  entity.market = event.params.market
  entity.to = event.params.to
  entity.fee = event.params.fee

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()
}

export function handleOrderCancelled(event: OrderCancelledEvent): void {
  const id = orderId(event.params.market, event.params.account, event.params.nonce)
  let entity = new MultiInvokerOrderCancelled(id)
  entity.account = event.params.account
  entity.market = event.params.market
  entity.nonce = event.params.nonce

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  const placedEntity = MultiInvokerOrderPlaced.load(id)
  if (placedEntity) {
    placedEntity.cancelled = true
    placedEntity.save()
  }
}

export function handleOrderExecuted(event: OrderExecutedEvent): void {
  const id = orderId(event.params.market, event.params.account, event.params.nonce)
  let entity = new MultiInvokerOrderExecuted(id)
  entity.account = event.params.account
  entity.market = event.params.market
  entity.nonce = event.params.nonce
  entity.positionId = event.params.positionId

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.save()

  const placedEntity = MultiInvokerOrderPlaced.load(id)
  if (placedEntity) {
    placedEntity.executed = true
    placedEntity.save()
  }
}

export function handleOrderPlaced(event: OrderPlacedEvent): void {
  let entity = new MultiInvokerOrderPlaced(orderId(event.params.market, event.params.account, event.params.nonce))
  entity.account = event.params.account
  entity.market = event.params.market
  entity.nonce = event.params.nonce
  entity.order_side = event.params.order.side
  entity.order_comparison = event.params.order.comparison
  entity.order_fee = event.params.order.fee
  entity.order_price = event.params.order.price
  entity.order_delta = event.params.order.delta

  entity.blockNumber = event.block.number
  entity.blockTimestamp = event.block.timestamp
  entity.transactionHash = event.transaction.hash

  entity.executed = false
  entity.cancelled = false

  entity.save()
}

function orderId(market: Address, account: Address, nonce: BigInt): Bytes {
  return Bytes.fromByteArray(crypto.keccak256(market.concat(account).concatI32(nonce.toI32())))
}
