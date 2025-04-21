import { Rx } from "@effect-rx/rx-react"
import { makeSearchParamRx } from "@/lib/searchParamRx"
import { BunningsClient, Products } from "@/RpcClient"
import { Effect, Layer, Stream } from "effect"

const runtimeRx = Rx.runtime(
  Layer.mergeAll(Products.Default, BunningsClient.Default),
).pipe(Rx.keepAlive)

export const queryRx = makeSearchParamRx("query")

export const queryIsSetRx = Rx.map(queryRx, (query) => query.trim() !== "")

export const loginRx = runtimeRx.rx(
  Effect.gen(function* () {
    const client = yield* BunningsClient
    yield* client.login()
  }),
)

export const resultsRx = runtimeRx.pull(
  Effect.fnUntraced(function* (get: Rx.Context) {
    const client = yield* BunningsClient
    const query = get(queryRx)
    if (query.trim() === "") {
      return Stream.empty
    }
    yield* Effect.sleep(150)
    return client.search({ query })
  }, Stream.unwrap),
)
