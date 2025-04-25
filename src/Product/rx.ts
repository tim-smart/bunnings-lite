import { Result, Rx } from "@effect-rx/rx-react"
import { BaseInfoKey, BunningsClient } from "@/RpcClient"
import { Effect, Stream } from "effect"
import { currentLocationRx } from "@/Stores/rx"
import { ProductBaseInfo } from "api/src/domain/Bunnings"

const runtimeRx = Rx.runtime(BunningsClient.Default).pipe(Rx.keepAlive)

export const preloadRx = Rx.fnSync((key: BaseInfoKey, get) => {
  get.once(productRx(key))
  get.once(productFullInfoRx(key.id))
  get.once(productFulfillmentRx(key.id))
  get.once(productReviewStatsRx(key.id))
  get.once(productReviewsRx(key.id))
})

export const productRx = Rx.family((key: BaseInfoKey) =>
  Rx.make((get) => {
    if (key.result) {
      return Result.success<ProductBaseInfo, never>(key.result)
    }
    return Result.map(get(productFullInfoRx(key.id)), (_) => _.asBaseInfo)
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
  runtimeRx
    .rx(
      Effect.gen(function* () {
        const products = yield* BunningsClient
        return yield* products.productReviewStats({ id })
      }),
    )
    .pipe(Rx.setIdleTTL("10 minutes")),
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
