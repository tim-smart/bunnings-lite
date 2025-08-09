import { rpcAtom } from "@/RpcClient"
import { currentLocationAtom } from "@/Stores/atoms"
import { Atom } from "@effect-atom/atom-react"
import * as Array from "effect/Array"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import { Facet, ProductBaseInfo } from "../../server/src/domain/Bunnings"
import * as Mailbox from "effect/Mailbox"
import { Unauthorized } from "server/src/domain/Auth"
import * as RpcClientError from "@effect/rpc/RpcClientError"

export const queryAtom = Atom.searchParam("query")

export const queryIsSetAtom = Atom.map(
  queryAtom,
  (query) => query.trim() !== "",
)

export const loginAtom = Atom.make(
  Effect.fnUntraced(function* (get) {
    const client = yield* get.result(rpcAtom.client)
    const location = get(currentLocationAtom)
    yield* client("login", { location })
  }),
)

const queryTrimmedAtom = Atom.map(queryAtom, (query) => query.trim())

const facetsAtom = Atom.make<{
  forQuery: string
  facets: ReadonlyArray<Facet>
}>({
  forQuery: "",
  facets: [],
}).pipe(Atom.keepAlive)

class Filter extends Data.Class<{
  id: string
  name: string
  kind: "slider" | "text"
  valuePrefix: string
  facetValueOverride?: {
    readonly start: number
    readonly end: number
    readonly endInclusive: boolean
  }
}> {}

const filterAtom = Atom.family((filter: Filter) => {
  const self = {
    filter,
    facet: filter.facetValueOverride
      ? Atom.make(Option.some(filter.facetValueOverride))
      : Atom.make((get) => {
          const facets = get(facetsAtom).facets
          return Array.findFirst(facets, (g) => g.facetId === filter.id).pipe(
            Option.flatMapNullable((_) => _.values[0]),
          )
        }),
    min: Atom.writable(
      () => Option.none<number>(),
      (ctx, value: number) => {
        ctx.setSelf(Option.some(value))
      },
    ).pipe(Atom.keepAlive),
    max: Atom.writable(
      () => Option.none<number>(),
      (ctx, value: number) => {
        ctx.setSelf(Option.some(value))
      },
    ).pipe(Atom.keepAlive),
    value: Atom.make(Option.none<readonly [number, number]>()),
    reset: Atom.fnSync((_: void, get) => {
      get.set(self.value, Option.none())
      get.refresh(self.min)
      get.refresh(self.max)
    }),
  }
  return self
})

export const allFilters = {
  priceRange: filterAtom(
    new Filter({
      id: "@price",
      name: "Price",
      kind: "text",
      valuePrefix: "$",
    }),
  ),
  ratingRange: filterAtom(
    new Filter({
      id: "@rating",
      name: "Rating",
      kind: "slider",
      valuePrefix: "",
      facetValueOverride: {
        start: 0,
        end: 5,
        endInclusive: true,
      },
    }),
  ),
}

const resetFilters = (get: Atom.Context) => {
  for (const filter of Object.values(allFilters)) {
    get.set(filter.value, Option.none())
  }
}
const resetFilterUi = (get: Atom.Context) => {
  for (const filter of Object.values(allFilters)) {
    get.refresh(filter.min)
    get.refresh(filter.max)
  }
}

export const resultsAtom = Atom.pull(
  Effect.fnUntraced(function* (get) {
    const client = yield* get.result(rpcAtom.client)
    const query = get(queryTrimmedAtom)
    if (query === "") {
      return Stream.empty
    }
    yield* Effect.sleep(150)
    if (query !== get.once(facetsAtom).forQuery) {
      resetFilters(get)
    }
    const mailbox = yield* Mailbox.make<
      ProductBaseInfo,
      Unauthorized | RpcClientError.RpcClientError
    >(32)
    yield* Effect.gen(function* () {
      let offset = 0
      while (true) {
        const data = yield* client("search", {
          query,
          offset,
          priceRange: get(allFilters.priceRange.value),
          ratingRange: get(allFilters.ratingRange.value),
        })
        if (offset === 0 && get.once(facetsAtom).forQuery !== query) {
          resetFilterUi(get)
          get.set(facetsAtom, { forQuery: query, facets: data.facets })
        }
        yield* mailbox.offerAll(data.results)
        offset += data.results.length
        if (offset >= data.totalCount) {
          break
        }
      }
    }).pipe(Mailbox.into(mailbox), Effect.forkScoped)
    return Mailbox.toStream(mailbox)
  }, Stream.unwrapScoped),
).pipe(Atom.keepAlive)

export const loadingAtom = Atom.map(resultsAtom, (_) => _.waiting)

export const focusAtom = Atom.writable(
  () => 0,
  (ctx, _: void) => {
    ctx.setSelf(ctx.get(focusAtom) + 1)
  },
)
