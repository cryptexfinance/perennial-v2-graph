import { BigInt } from '@graphprotocol/graph-ts'
import { MarketAccumulator } from '../../generated/schema'

export const BASE = BigInt.fromI32(10).pow(6)

export function accumulatorAccumulated(
  to: MarketAccumulator,
  from: MarketAccumulator,
  size: BigInt,
  side: string,
  subAccumulator: string,
): BigInt {
  let toValue = BigInt.zero()
  // For some reason enum comparison is strange in assembly script so we need to use loose equality
  if (side == 'maker') {
    if (subAccumulator === 'pnl') toValue = to.pnlMaker
    if (subAccumulator === 'funding') toValue = to.fundingMaker
    if (subAccumulator === 'interest') toValue = to.interestMaker
    if (subAccumulator === 'positionFee') toValue = to.positionFeeMaker
    if (subAccumulator === 'value') toValue = to.makerValue
    if (subAccumulator === 'reward') toValue = to.makerReward
  } else if (side == 'long') {
    if (subAccumulator === 'pnl') toValue = to.pnlLong
    if (subAccumulator === 'funding') toValue = to.fundingLong
    if (subAccumulator === 'interest') toValue = to.interestLong
    if (subAccumulator === 'value') toValue = to.longValue
    if (subAccumulator === 'reward') toValue = to.longReward
  } else if (side == 'short') {
    if (subAccumulator === 'pnl') toValue = to.pnlShort
    if (subAccumulator === 'funding') toValue = to.fundingShort
    if (subAccumulator === 'interest') toValue = to.interestShort
    if (subAccumulator === 'value') toValue = to.shortValue
    if (subAccumulator === 'reward') toValue = to.shortReward
  }

  let fromValue = BigInt.zero()
  if (side == 'maker') {
    if (subAccumulator === 'pnl') fromValue = from.pnlMaker
    if (subAccumulator === 'funding') fromValue = from.fundingMaker
    if (subAccumulator === 'interest') fromValue = from.interestMaker
    if (subAccumulator === 'positionFee') fromValue = from.positionFeeMaker
    if (subAccumulator === 'value') fromValue = from.makerValue
    if (subAccumulator === 'reward') fromValue = from.makerReward
  } else if (side == 'long') {
    if (subAccumulator === 'pnl') fromValue = from.pnlLong
    if (subAccumulator === 'funding') fromValue = from.fundingLong
    if (subAccumulator === 'interest') fromValue = from.interestLong
    if (subAccumulator === 'value') fromValue = from.longValue
    if (subAccumulator === 'reward') fromValue = from.longReward
  } else if (side == 'short') {
    if (subAccumulator === 'pnl') fromValue = from.pnlShort
    if (subAccumulator === 'funding') fromValue = from.fundingShort
    if (subAccumulator === 'interest') fromValue = from.interestShort
    if (subAccumulator === 'value') fromValue = from.shortValue
    if (subAccumulator === 'reward') fromValue = from.shortReward
  }

  return _accumulatorAccumulated(toValue, fromValue, size)
}

function _accumulatorAccumulated(value: BigInt, from: BigInt, total: BigInt): BigInt {
  const net = value.minus(from)
  return isNeg(net) ? mulOut(net, total) : mul(net, total)
}

export function accumulatorIncrement(value: BigInt, amount: BigInt, total: BigInt): BigInt {
  if (amount.equals(BigInt.zero())) return value

  const distributed = isNeg(amount) ? divOut(amount, total) : div(amount, total)
  return value.plus(distributed)
}

export function mul(a: BigInt, b: BigInt): BigInt {
  return a.times(b).div(BASE)
}

export function mulOut(a: BigInt, b: BigInt): BigInt {
  return _divOut(a.times(b), BASE)
}

export function div(a: BigInt, b: BigInt): BigInt {
  return a.times(BASE).div(b)
}

export function divOut(a: BigInt, b: BigInt): BigInt {
  return sign(a)
    .times(sign(b))
    .times(ceilDiv(a.abs().times(BASE), b.abs()))
}

function _divOut(a: BigInt, b: BigInt): BigInt {
  return sign(a)
    .times(sign(b))
    .times(ceilDiv(a.abs(), b.abs()))
}

function ceilDiv(a: BigInt, b: BigInt): BigInt {
  return a.equals(BigInt.zero())
    ? BigInt.zero()
    : a
        .minus(BigInt.fromI32(1))
        .div(b)
        .plus(BigInt.fromI32(1))
}

function sign(a: BigInt): BigInt {
  return a.gt(BigInt.zero()) ? BigInt.fromI32(1) : BigInt.fromI32(-1)
}

function isNeg(a: BigInt): boolean {
  return a.lt(BigInt.zero())
}

export function fromBig18(amount: BigInt, ceil: boolean): BigInt {
  if (ceil) return ceilDiv(amount, BigInt.fromI32(10).pow(12))
  return amount.div(BigInt.fromI32(10).pow(12))
}
