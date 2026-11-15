import { Effect, Schema } from "effect"
import { Route } from "@effect/ui"

// The search text. A URL without it means an empty search, and `print` leaves
// an empty one out, so the home page stays `/`.
const searchText = Schema.String.pipe(
  Schema.withDecodingDefaultKey(Effect.succeed("")),
)

// One end of a price or rating filter. A filter applies when both of its
// ends are in the URL.
const bound = Schema.optional(Schema.Finite)

export const AppRoute = Route.union({
  Search: Route.make("/", {
    query: {
      query: searchText,
      priceMin: bound,
      priceMax: bound,
      ratingMin: bound,
      ratingMax: bound,
    },
  }),
  // A product keeps the search it was opened from, so the search box still
  // shows it and typing there goes back to the results.
  Product: Route.make("/product/:id", {
    params: { id: Schema.String },
    query: { query: searchText },
  }),
  NotFound: Route.make("/*"),
})

export type AppRoute = typeof AppRoute.Type

export const SearchRoute = AppRoute.subset(["Search"])
export type SearchRoute = typeof SearchRoute.Type

export const productUrl = (id: string, query: string) =>
  AppRoute.print(
    AppRoute.make({ _tag: "Product", params: { id }, query: { query } }),
  )

/** The search text of whichever route is showing. */
export const queryOf = (route: AppRoute): string =>
  route._tag === "NotFound" ? "" : route.query.query
