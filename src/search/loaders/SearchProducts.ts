import { Effect, Option, Schema } from "effect"
import { Loader } from "@effect/ui"
import { KnownProducts } from "../../product/services/KnownProducts.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { SessionTag } from "../../rpc/domain/SessionTag.ts"
import { Session } from "../../rpc/services/Session.ts"
import { ResultsPage, SearchArgs } from "../domain/Search.ts"

/** The results of a search, a page at a time. The cursor is the offset. */
export class SearchProducts extends Loader.ListService<SearchProducts>()(
  "search/SearchProducts",
  {
    args: SearchArgs.fields,
    page: ResultsPage,
    items: (page) => page.results,
    key: (product) => product.id,
    error: ApiError,
    cursor: Schema.Number,
    next: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, page) => n + page.results.length, 0)
      return lastPage.results.length > 0 && loaded < lastPage.totalCount
        ? Option.some(loaded)
        : Option.none()
    },
    staleTime: "5 minutes",
    tags: [SessionTag],
  },
  Effect.gen(function* () {
    const session = yield* Session
    const known = yield* KnownProducts
    return ({ price, query, rating }, cursor) =>
      session
        .use((client) =>
          client.search({
            query,
            offset: Option.getOrElse(cursor, () => 0),
            priceRange: Option.fromNullishOr(price),
            ratingRange: Option.fromNullishOr(rating),
          }),
        )
        .pipe(
          Effect.tap((data) => Effect.sync(() => known.remember(data.results))),
          Effect.map(({ facets, results, totalCount }): ResultsPage => ({
            facets,
            results,
            totalCount,
          })),
        )
  }),
) {}
