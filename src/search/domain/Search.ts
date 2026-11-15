import { Schema } from "effect"
import { Facet, ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import type { AppRoute } from "../../routes.ts"

/** The two ends of a price or rating filter. */
const Range = Schema.Tuple([Schema.Finite, Schema.Finite])
type Range = typeof Range.Type

export const SearchArgs = Schema.Struct({
  query: Schema.String,
  price: Schema.NullOr(Range),
  rating: Schema.NullOr(Range),
})
export type SearchArgs = typeof SearchArgs.Type

const rangeOf = (
  min: number | undefined,
  max: number | undefined,
): Range | null => (min === undefined || max === undefined ? null : [min, max])

/**
 * The search a route asks for, or `undefined` when it asks for none: any
 * route but the search page, or a search with no text. A filter applies when
 * both of its ends are in the URL.
 */
export const searchArgs = (route: AppRoute): SearchArgs | undefined => {
  if (route._tag !== "Search") return undefined
  const { priceMax, priceMin, query, ratingMax, ratingMin } = route.query
  const trimmed = query.trim()
  if (trimmed === "") return undefined
  return {
    query: trimmed,
    price: rangeOf(priceMin, priceMax),
    rating: rangeOf(ratingMin, ratingMax),
  }
}

/**
 * Whether going from one route to the next clears the search back to the
 * home page.
 */
export const searchCleared = (from: AppRoute, to: AppRoute): boolean =>
  to._tag === "Search" &&
  searchArgs(from) !== undefined &&
  searchArgs(to) === undefined

/** How long the search waits for typing to stop. */
export const searchDebounce = "150 millis"

/** A page of results. */
export const ResultsPage = Schema.Struct({
  totalCount: Schema.Number,
  facets: Schema.Array(Facet),
  results: Schema.Array(ProductBaseInfo),
})
export type ResultsPage = typeof ResultsPage.Type

/** The lowest and highest value a filter can take for a search. */
export const FacetRange = Schema.Struct({
  start: Schema.Number,
  end: Schema.Number,
})
export type FacetRange = typeof FacetRange.Type

/** The range of prices in a page's search, when the server reports one. */
export const priceFacet = (page: ResultsPage): FacetRange | null => {
  const value = page.facets.find((facet) => facet.facetId === "@price")
    ?.values[0]
  return value === undefined ? null : { start: value.start, end: value.end }
}

/** Ratings always run from none to five stars. */
export const ratingFacet: FacetRange = { start: 0, end: 5 }
