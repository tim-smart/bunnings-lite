import { Result, Rx } from "@effect-rx/rx-react"
import { BaseInfoKey, BunningsClient } from "@/RpcClient"
import { Effect, Option, Stream } from "effect"
import { currentLocationRx } from "@/Stores/rx"
import { ProductBaseInfo } from "server/src/domain/Bunnings"

const runtimeRx = Rx.runtime(BunningsClient.Default)

export const preloadRx = Rx.fnSync((key: BaseInfoKey, get) => {
  get(productRx(key))
  get(productFulfillmentRx(key.id))
  get(productReviewStatsRx(key.id))
  get(productReviewsRx(key.id))
})

export const productRx = Rx.family((key: BaseInfoKey) =>
  Rx.make((get) => {
    const fullInfo = get(productFullInfoRx(key.id))
    if (key.result && fullInfo._tag !== "Success") {
      return Result.success(key.result)
    }
    return Result.map(fullInfo, (_) => _.asBaseInfo)
  }).pipe(Rx.setIdleTTL("5 minutes")),
)

export const productFullInfoRx = Rx.family((id: string) =>
  runtimeRx
    .rx(
      Effect.gen(function* () {
        const products = yield* BunningsClient
        return yield* products.productInfo({ id })
      }),
    )
    .pipe(Rx.setIdleTTL("10 minutes")),
)

export const productReviewStatsRx = Rx.family((id: string) =>
  runtimeRx.rx(BunningsClient.use((_) => _.productReviewStats({ id }))).pipe(
    Rx.map((_) => Option.flatten(Result.value(_))),
    Rx.setIdleTTL("10 minutes"),
  ),
)

export const productReviewCountRx = Rx.family((product: ProductBaseInfo) =>
  Rx.make((get) => {
    const stats = get(productReviewStatsRx(product.id))
    return Option.isSome(stats)
      ? stats.value.ReviewStatistics.TotalReviewCount
      : product.numberOfReviews
  }),
)

export const productRatingRx = Rx.family((product: ProductBaseInfo) =>
  Rx.make((get) => {
    const stats = get(productReviewStatsRx(product.id))
    return Option.isSome(stats)
      ? stats.value.ReviewStatistics.AverageOverallRating
      : product.rating
  }),
)

export const productReviewsRx = Rx.family((id: string) =>
  runtimeRx
    .pull(
      Effect.gen(function* () {
        const products = yield* BunningsClient
        return products.productReviews({ id })
      }).pipe(Stream.unwrap),
    )
    .pipe(Rx.setIdleTTL("5 minutes")),
)

export const productFulfillmentRx = Rx.family((id: string) =>
  runtimeRx
    .rx(
      Effect.fnUntraced(function* (get: Rx.Context) {
        get(currentLocationRx)
        const products = yield* BunningsClient
        return yield* products.fulfillment({ id })
      }),
    )
    .pipe(Rx.setIdleTTL("15 minutes")),
)
