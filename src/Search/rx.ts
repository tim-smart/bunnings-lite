import { Rx } from "@effect-rx/rx-react"
import { makeSearchParamRx } from "@/lib/searchParamRx"
import { BunningsClient, Products } from "@/RpcClient"
import { Chunk, Effect, Layer, Option, Stream } from "effect"
import { DevTools } from "@effect/experimental"

const runtimeRx = Rx.runtime(
  Layer.mergeAll(Products.Default, BunningsClient.Default).pipe(
    Layer.provideMerge(DevTools.layer()),
  ),
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
    const client = yield* Products
    return get.stream(queryRx).pipe(
      Stream.changes,
      Stream.debounce(150),
      Stream.flatMap(
        (query) => {
          if (query.trim() === "") {
            get.refreshSelfSync()
            return Stream.empty
          }
          return Stream.paginateChunkEffect(0, (offset) =>
            client
              .search(query, offset)
              .pipe(
                Effect.map(
                  (res) =>
                    [
                      Chunk.map(res.data.results, (_) => _.raw),
                      Option.some(offset + res.data.results.length).pipe(
                        Option.filter((count) => count < res.data.totalCount),
                      ),
                    ] as const,
                ),
              ),
          )
        },
        { switch: true, bufferSize: 0 },
      ),
    )
  }, Stream.unwrap),
)
