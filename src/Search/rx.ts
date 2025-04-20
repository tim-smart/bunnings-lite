import { Rx } from "@effect-rx/rx-react"
import { makeSearchParamRx } from "@/lib/searchParamRx"
import { BunningsClient } from "@/RpcClient"
import { Effect, Stream } from "effect"

const runtimeRx = Rx.runtime(BunningsClient.Default).pipe(Rx.keepAlive)

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
    return get.stream(queryRx).pipe(
      Stream.changes,
      Stream.debounce(150),
      Stream.flatMap(
        (query) => {
          if (query.trim() === "") {
            get.refreshSelfSync()
            return Stream.empty
          }
          return client.search({ query: get(queryRx) })
        },
        { switch: true },
      ),
    )
  }, Stream.unwrap),
)
