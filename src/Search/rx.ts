import { Rx } from "@effect-rx/rx-react"
import { BunningsClient } from "@/RpcClient"
import { Chunk, Effect, Option, Stream } from "effect"
import { currentLocationRx } from "@/Stores/rx"
import { GroupByResult } from "../../api/src/domain/Bunnings"

const runtimeRx = Rx.runtime(BunningsClient.Default).pipe(Rx.keepAlive)

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

export const groupByRx = Rx.make<ReadonlyArray<GroupByResult>>([]).pipe(
  Rx.keepAlive,
)

export const resultsRx = runtimeRx
  .pull(
    Effect.fnUntraced(function* (get: Rx.Context) {
      const client = yield* BunningsClient
      const query = get(queryTrimmedRx)
      if (query === "") {
        return Stream.empty
      }
      yield* Effect.sleep(150)
      return Stream.paginateChunkEffect(0, (offset) =>
        client.search({ query, offset }).pipe(
          Effect.map((data) => {
            get.set(groupByRx, data.groupByResults)
            return [
              Chunk.unsafeFromArray(data.results),
              Option.some(data.results.length + offset).pipe(
                Option.filter((len) => len < data.totalCount),
              ),
            ] as const
          }),
        ),
      )
    }, Stream.unwrap),
  )
  .pipe(Rx.keepAlive)

export const loadingRx = Rx.map(resultsRx, (_) => _.waiting)

let count = 0
export const focusRx = Rx.fnSync((_: void) => count++)
