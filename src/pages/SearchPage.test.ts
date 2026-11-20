import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { HtmlLocator, HtmlScene } from "@effect/ui/html/testing"
import type { View } from "@effect/ui"
import { Scene } from "@effect/ui/testing"
import {
  Facet,
  FacetValue,
  ImageElement,
  ProductBaseInfo,
} from "../../server/src/domain/Bunnings.ts"
import type { SearchRoute } from "../routes.ts"
import { Filters } from "../search/components/Filters.ts"
import type { ResultsPage } from "../search/domain/Search.ts"
import { SearchPageNoDeps } from "./SearchPage.ts"

const route = (query: string): SearchRoute => ({
  _tag: "Search",
  params: {},
  search: { query },
})

const page = (query: string): ResultsPage => ({
  totalCount: 1,
  facets: [
    new Facet({
      facetId: "@price",
      values: [new FacetValue({ start: 0, end: 500, endInclusive: true })],
    }),
  ],
  results: [
    new ProductBaseInfo({
      id: `${query}-1`,
      title: `A ${query}`,
      url: `https://example.com/${query}-1`,
      images: [
        new ImageElement({
          url: "https://example.com/i.jpg",
          thumbnailUrl: "https://example.com/t.jpg",
          mime: "image/jpeg",
          sequence: "0",
        }),
      ],
      price: 20,
      numberOfReviews: 1,
      rating: 4,
    }),
  ],
})

const loading = HtmlLocator.role("status", { name: "Loading results" })

const filters = (view: View.Node<any, any>) => Scene.children(view, Filters)

describe("SearchPage", () => {
  it.effect("keeps the last results up while the search text changes", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(SearchPageNoDeps, {
        route: route("hammer"),
      })
      s.loaded("results", [page("hammer")])
        .loaded("unfiltered", [page("hammer")])
        .props({ route: route("drill") })
        // The drill search is still on its way
        .keepPending("results")
        .keepPending("unfiltered")
        .expect(loading)
        .toBeAbsent()
      assert.strictEqual(filters(s.view).length, 1)
    }),
  )

  it.effect("starts the filters over for another search", () =>
    Effect.gen(function* () {
      const s = yield* HtmlScene.make(SearchPageNoDeps, {
        route: route("hammer"),
      })
      s.loaded("results", [page("hammer")]).loaded("unfiltered", [
        page("hammer"),
      ])
      const before = filters(s.view)[0].key
      s.props({ route: route("drill") })
        .keepPending("results")
        .keepPending("unfiltered")
      // A new key mounts new filters, without what was typed under the last one
      assert.notStrictEqual(before, filters(s.view)[0].key)
    }),
  )
})
