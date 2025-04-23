import { Result, Rx } from "@effect-rx/rx-react"
import { BunningsClient, Products } from "@/RpcClient"
import { Effect, Layer, Stream } from "effect"
import { currentLocationRx } from "@/Stores/rx"

const runtimeRx = Rx.runtime(
  Layer.mergeAll(Products.Default, BunningsClient.Default),
).pipe(Rx.keepAlive)

export const queryRx = Rx.searchParam("query")

export const queryIsSetRx = Rx.map(queryRx, (query) => query.trim() !== "")

export const loginRx = runtimeRx.rx(
  Effect.fnUntraced(function* (get: Rx.Context) {
    const client = yield* BunningsClient
    const location = get(currentLocationRx)
    yield* client.login({ location })
  }),
)

const queryTrimmedRx = Rx.map(queryRx, (query) => query.trim())

export const resultsRx = runtimeRx
  .pull(
    Effect.fnUntraced(function* (get: Rx.Context) {
      const client = yield* BunningsClient
      const query = get(queryTrimmedRx)
      if (query === "") {
        return Stream.empty
      }
      yield* Effect.sleep(150)
      return client.search({ query }).pipe(Stream.bufferChunks({ capacity: 1 }))
    }, Stream.unwrap),
  )
  .pipe(Rx.keepAlive)

export const loadingRx = Rx.map(resultsRx, (_) => _.waiting)

let count = 0
export const focusRx = Rx.fnSync((_: void) => count++)
