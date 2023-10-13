import { BigInt } from '@graphprotocol/graph-ts'
import { div, mul } from './big6Math'
import { BucketedVolume, PositionProcessed } from '../../generated/schema'
import { PositionProcessed as PositionProcessedEvent } from '../../generated/templates/Market/Market'

let VOLUME_STAT_BASE = 'Volume:'

export function updateBucketedVolumes(
  entity: PositionProcessed,
  event: PositionProcessedEvent,
  fromPrice: BigInt,
  fromMaker: BigInt,
  fromLong: BigInt,
  fromShort: BigInt,
  makerDelta: BigInt,
  longDelta: BigInt,
  shortDelta: BigInt,
): void {
  const buckets = ['hourly', 'daily', 'weekly', 'all']
  const timestamp = entity.fromOracleVersion
  const market = entity.market
  const version = entity.toOracleVersion

  for (let i = 0; i < buckets.length; i++) {
    const timestampBucket = timestampToBucket(timestamp, buckets[i])
    const id = VOLUME_STAT_BASE.concat(market.toHexString())
      .concat(':')
      .concat(buckets[i])
      .concat(':')
      .concat(timestampBucket.toString())
    let bucketedStat = BucketedVolume.load(id)
    if (bucketedStat === null) {
      bucketedStat = new BucketedVolume(id)
      bucketedStat.bucket = buckets[i]
      bucketedStat.market = market
      bucketedStat.periodStartBlock = event.block.number
      bucketedStat.periodStartTimestamp = timestampBucket
      bucketedStat.periodStartVersion = version
      bucketedStat.periodEndBlock = event.block.number
      bucketedStat.periodEndVersion = version
      bucketedStat.positionFeeMaker = BigInt.zero()
      bucketedStat.positionFeeFee = BigInt.zero()
      bucketedStat.fundingMaker = BigInt.zero()
      bucketedStat.fundingLong = BigInt.zero()
      bucketedStat.fundingShort = BigInt.zero()
      bucketedStat.fundingFee = BigInt.zero()
      bucketedStat.interestMaker = BigInt.zero()
      bucketedStat.interestLong = BigInt.zero()
      bucketedStat.interestShort = BigInt.zero()
      bucketedStat.interestFee = BigInt.zero()
      bucketedStat.pnlMaker = BigInt.zero()
      bucketedStat.pnlLong = BigInt.zero()
      bucketedStat.pnlShort = BigInt.zero()
      bucketedStat.rewardMaker = BigInt.zero()
      bucketedStat.rewardLong = BigInt.zero()
      bucketedStat.rewardShort = BigInt.zero()
      bucketedStat.makerAmount = BigInt.zero()
      bucketedStat.longAmount = BigInt.zero()
      bucketedStat.shortAmount = BigInt.zero()
      bucketedStat.makerNotional = BigInt.zero()
      bucketedStat.longNotional = BigInt.zero()
      bucketedStat.shortNotional = BigInt.zero()
      bucketedStat.weightedMakerFunding = BigInt.zero()
      bucketedStat.weightedMakerInterest = BigInt.zero()
      bucketedStat.weightedMakerPositionFees = BigInt.zero()
      bucketedStat.weightedLongFunding = BigInt.zero()
      bucketedStat.weightedLongInterest = BigInt.zero()
      bucketedStat.weightedShortFunding = BigInt.zero()
      bucketedStat.weightedShortInterest = BigInt.zero()
      bucketedStat.totalWeight = BigInt.zero()
    }

    bucketedStat.positionFeeMaker = bucketedStat.positionFeeMaker.plus(entity.accumulationResult_positionFeeMaker)
    bucketedStat.positionFeeFee = bucketedStat.positionFeeFee.plus(entity.accumulationResult_positionFeeFee)
    bucketedStat.fundingMaker = bucketedStat.fundingMaker.plus(entity.accumulationResult_fundingMaker)
    bucketedStat.fundingLong = bucketedStat.fundingLong.plus(entity.accumulationResult_fundingLong)
    bucketedStat.fundingShort = bucketedStat.fundingShort.plus(entity.accumulationResult_fundingShort)
    bucketedStat.fundingFee = bucketedStat.fundingFee.plus(entity.accumulationResult_fundingFee)
    bucketedStat.interestMaker = bucketedStat.interestMaker.plus(entity.accumulationResult_interestMaker)
    bucketedStat.interestLong = bucketedStat.interestLong.plus(entity.accumulationResult_interestLong)
    bucketedStat.interestShort = bucketedStat.interestShort.plus(entity.accumulationResult_interestShort)
    bucketedStat.interestFee = bucketedStat.interestFee.plus(entity.accumulationResult_interestFee)
    bucketedStat.pnlMaker = bucketedStat.pnlMaker.plus(entity.accumulationResult_pnlMaker)
    bucketedStat.pnlLong = bucketedStat.pnlLong.plus(entity.accumulationResult_pnlLong)
    bucketedStat.pnlShort = bucketedStat.pnlShort.plus(entity.accumulationResult_pnlShort)
    bucketedStat.rewardMaker = bucketedStat.rewardMaker.plus(entity.accumulationResult_rewardMaker)
    bucketedStat.rewardLong = bucketedStat.rewardLong.plus(entity.accumulationResult_rewardLong)
    bucketedStat.rewardShort = bucketedStat.rewardShort.plus(entity.accumulationResult_rewardShort)

    if (entity.toVersionValid) {
      bucketedStat.makerAmount = bucketedStat.makerAmount.plus(makerDelta.abs())
      bucketedStat.longAmount = bucketedStat.longAmount.plus(longDelta.abs())
      bucketedStat.shortAmount = bucketedStat.shortAmount.plus(shortDelta.abs())

      bucketedStat.makerNotional = bucketedStat.makerNotional.plus(mul(makerDelta, entity.toVersionPrice).abs())
      bucketedStat.longNotional = bucketedStat.longNotional.plus(mul(longDelta, entity.toVersionPrice).abs())
      bucketedStat.shortNotional = bucketedStat.shortNotional.plus(mul(shortDelta, entity.toVersionPrice).abs())
    }

    const weight = event.params.toOracleVersion.minus(event.params.fromOracleVersion)
    bucketedStat.totalWeight = bucketedStat.totalWeight.plus(weight)

    const makerNotional = mul(fromMaker, fromPrice).abs()
    if (makerNotional.gt(BigInt.zero())) {
      bucketedStat.weightedMakerFunding = bucketedStat.weightedMakerFunding.plus(
        div(mul(entity.accumulationResult_fundingMaker, weight), makerNotional),
      )
      bucketedStat.weightedMakerInterest = bucketedStat.weightedMakerInterest.plus(
        div(mul(entity.accumulationResult_interestMaker, weight), makerNotional),
      )
      bucketedStat.weightedMakerPositionFees = bucketedStat.weightedMakerPositionFees.plus(
        div(mul(entity.accumulationResult_positionFeeMaker, weight), makerNotional),
      )
    }

    const longNotional = mul(fromLong, fromPrice).abs()
    if (longNotional.gt(BigInt.zero())) {
      bucketedStat.weightedLongFunding = bucketedStat.weightedLongFunding.plus(
        div(mul(entity.accumulationResult_fundingLong, weight), longNotional),
      )
      bucketedStat.weightedLongInterest = bucketedStat.weightedLongInterest.plus(
        div(mul(entity.accumulationResult_interestLong, weight), longNotional),
      )
    }

    const shortNotional = mul(fromShort, fromPrice).abs()
    if (shortNotional.gt(BigInt.zero())) {
      bucketedStat.weightedShortFunding = bucketedStat.weightedShortFunding.plus(
        div(mul(entity.accumulationResult_fundingShort, weight), shortNotional),
      )
      bucketedStat.weightedShortInterest = bucketedStat.weightedShortInterest.plus(
        div(mul(entity.accumulationResult_interestShort, weight), shortNotional),
      )
    }

    bucketedStat.periodEndTimestamp = event.block.timestamp
    bucketedStat.periodEndBlock = event.block.number
    bucketedStat.periodEndVersion = version

    bucketedStat.save()
  }
}

export function timestampToBucket(timestamp: BigInt, bucket: string): BigInt {
  let bucketTime: BigInt

  if (bucket === 'daily') {
    bucketTime = BigInt.fromI32(86400)
  } else if (bucket === 'hourly') {
    bucketTime = BigInt.fromI32(3600)
  } else if (bucket === 'weekly') {
    bucketTime = BigInt.fromI32(86400 * 7)
  } else if (bucket === 'all') {
    bucketTime = BigInt.zero()
  } else {
    throw new Error('Invalid bucket ' + bucket)
  }

  if (bucketTime.equals(BigInt.zero())) return bucketTime
  return timestamp.div(bucketTime).times(bucketTime)
}
