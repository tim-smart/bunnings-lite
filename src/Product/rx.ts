import { Rx } from "@effect-rx/rx-react"
import { BaseInfoKey, Products } from "@/RpcClient"
import { Effect, Layer } from "effect"
import { DevTools } from "@effect/experimental"

const runtimeRx = Rx.runtime(
  Products.Default.pipe(Layer.provideMerge(DevTools.layer())),
).pipe(Rx.keepAlive)

export const preloadRx = runtimeRx.fn(
  Effect.fnUntraced(function* (key: BaseInfoKey) {
    const products = yield* Products
    yield* products.getBaseInfo(key)
    yield* Effect.forkDaemon(products.getFullInfo(key.id))
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
