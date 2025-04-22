import { Rx } from "@effect-rx/rx-react"
import { BaseInfoKey, Products } from "@/RpcClient"
import { Effect, Stream } from "effect"

const runtimeRx = Rx.runtime(Products.Default).pipe(Rx.keepAlive)

export const preloadRx = runtimeRx.fn(
  Effect.fnUntraced(function* (key: BaseInfoKey, get: Rx.Context) {
    const products = yield* Products
    yield* products.getBaseInfo(key)
    yield* Effect.forkDaemon(products.getFullInfo(key.id))
    yield* Effect.forkDaemon(products.getReviewStats(key.id))
    get.once(productReviewsRx(key.id))
  }),
)

export const productRx = Rx.family((id: string) =>
  runtimeRx.rx(
    Effect.gen(function* () {
      const products = yield* Products
      return yield* products.getBaseInfo(new BaseInfoKey({ id }))
    }),
  ),
)

export const productFullInfoRx = Rx.family((id: string) =>
  runtimeRx.rx(
    Effect.gen(function* () {
      const products = yield* Products
      return yield* products.getFullInfo(id)
    }),
  ),
)

export const productReviewStatsRx = Rx.family((id: string) =>
  runtimeRx.rx(
    Effect.gen(function* () {
      const products = yield* Products
      return yield* products.getReviewStats(id)
    }),
  ),
)

export const productReviewsRx = Rx.family((id: string) =>
  runtimeRx
    .pull(
      Effect.gen(function* () {
        const products = yield* Products
        return products.getReviews(id)
      }).pipe(Stream.unwrap),
    )
    .pipe(Rx.setIdleTTL("5 minutes")),
)

export const productFulfillmentRx = Rx.family((id: string) =>
  runtimeRx
    .rx(
      Effect.fnUntraced(function* (_get: Rx.Context) {
        const products = yield* Products
        return yield* products.getFulfillment(id)
      }),
    )
    .pipe(Rx.setIdleTTL("5 minutes")),
)
