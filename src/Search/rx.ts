import { Rx } from "@effect-rx/rx-react"
import { BunningsClient } from "@/RpcClient"
import { Array, Chunk, Data, Effect, Option, Stream } from "effect"
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

class Filter extends Data.Class<{
  id: string
  name: string
  valuePrefix: string
  facetValueOverride?: {
    readonly start: number
    readonly end: number
    readonly endInclusive: boolean
  }
}> {}

const filterRx = Rx.family((filter: Filter) => {
  const self = {
    filter,
    facet: filter.facetValueOverride
      ? Rx.make(Option.some(filter.facetValueOverride))
      : Rx.make((get) => {
          const facets = get(facetsRx).facets
          return Array.findFirst(facets, (g) => g.facetId === filter.id).pipe(
            Option.flatMapNullable((_) => _.values[0]),
          )
        }),
    min: Rx.writable(
      () => Option.none<number>(),
      (ctx, value: number) => {
        ctx.setSelf(Option.some(value))
      },
    ).pipe(Rx.refreshable),
    max: Rx.writable(
      () => Option.none<number>(),
      (ctx, value: number) => {
        ctx.setSelf(Option.some(value))
      },
    ).pipe(Rx.refreshable),
    value: Rx.make(Option.none<readonly [number, number]>()),
    reset: Rx.fnSync((_: void, get) => {
      get.set(self.value, Option.none())
      get.refresh(self.min)
      get.refresh(self.max)
    }),
  }
  return self
})

export const allFilters = {
  priceRange: filterRx(
    new Filter({ id: "@price", name: "Price", valuePrefix: "$" }),
  ),
  ratingRange: filterRx(
    new Filter({
      id: "@rating",
      name: "Rating",
      valuePrefix: "",
      facetValueOverride: {
        start: 0,
        end: 5,
        endInclusive: true,
      },
    }),
  ),
}

const resetFilters = (get: Rx.Context) => {
  for (const filter of Object.values(allFilters)) {
    get.set(filter.value, Option.none())
    if (filter.filter.facetValueOverride) {
      get.refresh(filter.min)
      get.refresh(filter.max)
    }
  }
}
const resetFilterUi = (get: Rx.Context) => {
  for (const filter of Object.values(allFilters)) {
    if (filter.filter.facetValueOverride) continue
    get.refresh(filter.min)
    get.refresh(filter.max)
  }
}

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
        resetFilters(get)
      }
      return Stream.paginateChunkEffect(0, (offset) => {
        return client
          .search({
            query,
            offset,
            priceRange: get(allFilters.priceRange.value),
            ratingRange: get(allFilters.ratingRange.value),
          })
          .pipe(
            Effect.map((data) => {
              if (offset === 0) {
                resetFilterUi(get)
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
