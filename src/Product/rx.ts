import { Rx } from "@effect-rx/rx-react"
import { BaseInfoKey, Products } from "@/RpcClient"
import { Effect } from "effect"

const runtimeRx = Rx.runtime(Products.Default).pipe(Rx.keepAlive)

export const preloadRx = runtimeRx.fn(
  Effect.fnUntraced(function* (key: BaseInfoKey) {
    const products = yield* Products
    yield* products.getBaseInfo(key)
    yield* Effect.forkDaemon(products.getFullInfo(key.id))
    yield* Effect.forkDaemon(products.getReviews(key.id))
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

export const productReviewsRx = Rx.family((id: string) =>
  runtimeRx.rx(
    Effect.gen(function* () {
      const products = yield* Products
      return yield* products.getReviews(id)
    }),
  ),
)
