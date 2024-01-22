import { Address, BigInt, Bytes, crypto } from '@graphprotocol/graph-ts'
import {
  InterfaceFeeCharged as InterfaceFeeChargedEvent,
  Initialized as InitializedEvent,
  KeeperCall as KeeperCallEvent,
  KeeperFeeCharged as KeeperFeeChargedEvent,
  OrderExecuted as OrderExecutedEvent,
  OrderCancelled as OrderCancelledEvent,
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

export function handleInterfaceFeeCharged(event: InterfaceFeeChargedEvent): void {
  let entity = new MultiInvokerFeeCharged(event.transaction.hash.concatI32(event.logIndex.toI32()))
  entity.account = event.params.account
  entity.market = event.params.market
  entity.to = event.params.fee.receiver
  entity.amount = event.params.fee.amount
  entity.unwrap = event.params.fee.unwrap

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
  entity.applicableGas = event.params.applicableGas
  entity.applicableValue = event.params.applicableValue
  entity.baseFee = event.params.baseFee
  entity.calldataFee = event.params.calldataFee
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
  // Check if this is a noOp cancellation
  if (MultiInvokerOrderCancelled.load(id) != null) return

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
  // Check if this is a noOp execution
  if (MultiInvokerOrderExecuted.load(id) != null) return

  let entity = new MultiInvokerOrderExecuted(id)
  entity.account = event.params.account
  entity.market = event.params.market
  entity.nonce = event.params.nonce

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
  entity.order_interfaceFee_amount = event.params.order.interfaceFee1.amount
  entity.order_interfaceFee_receiver = event.params.order.interfaceFee1.receiver
  entity.order_interfaceFee_unwrap = event.params.order.interfaceFee1.unwrap
  entity.order_interfaceFee2_amount = event.params.order.interfaceFee2.amount
  entity.order_interfaceFee2_receiver = event.params.order.interfaceFee2.receiver
  entity.order_interfaceFee2_unwrap = event.params.order.interfaceFee2.unwrap

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
