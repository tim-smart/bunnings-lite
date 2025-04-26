import { Rx } from "@effect-rx/rx-react"
import { BunningsClient } from "@/RpcClient"
import { Array, Chunk, Effect, Option, Stream } from "effect"
import { currentLocationRx } from "@/Stores/rx"
import { Facet } from "../../api/src/domain/Bunnings"

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

const facetsRx = Rx.make<{
  forQuery: string
  facets: ReadonlyArray<Facet>
}>({
  forQuery: "",
  facets: [],
}).pipe(Rx.keepAlive)

export const filtersRx = Rx.make((get) => {
  const facets = get(facetsRx).facets
  const priceRange = Array.findFirst(
    facets,
    (g) => g.facetId === "@price",
  ).pipe(Option.flatMapNullable((_) => _.values[0]))
  return { priceRange } as const
})

export const resultsRx = runtimeRx
  .pull(
    Effect.fnUntraced(function* (get: Rx.Context) {
      const client = yield* BunningsClient
      const query = get(queryTrimmedRx)
      if (query === "") {
        return Stream.empty
      }
      yield* Effect.sleep(150)
      if (query !== get.once(facetsRx).forQuery) {
        get.refresh(minPriceRx)
        get.refresh(maxPriceRx)
      }
      return Stream.paginateChunkEffect(0, (offset) => {
        return client
          .search({ query, offset, priceRange: get(priceFilterRx) })
          .pipe(
            Effect.map((data) => {
              if (offset === 0) {
                get.set(facetsRx, { forQuery: query, facets: data.facets })
              }
              return [
                Chunk.unsafeFromArray(data.results),
                Option.some(data.results.length + offset).pipe(
                  Option.filter((len) => len < data.totalCount),
                ),
              ] as const
            }),
          )
      })
    }, Stream.unwrap),
  )
  .pipe(Rx.keepAlive)

export const loadingRx = Rx.map(resultsRx, (_) => _.waiting)

export const focusRx = Rx.writable(
  () => 0,
  (ctx, _: void) => {
    ctx.setSelf(ctx.get(focusRx) + 1)
  },
)

export const minPriceRx = Rx.writable(
  () => Option.none<number>(),
  (ctx, value: number) => {
    ctx.setSelf(Option.some(value))
  },
).pipe(Rx.refreshable)

export const maxPriceRx = Rx.writable(
  () => Option.none<number>(),
  (ctx, value: number) => {
    ctx.setSelf(Option.some(value))
  },
).pipe(Rx.refreshable)

const priceFilterRx = Rx.make((get) =>
  Option.all([get(minPriceRx), get(maxPriceRx)]),
)
