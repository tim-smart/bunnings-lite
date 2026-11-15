import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { HtmlQuery } from "@effect/ui/html/testing"
import type { View } from "@effect/ui"
import { Story } from "@effect/ui/testing"
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
  query: { query },
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

const loading = HtmlQuery.role("status", { name: "Loading results" })

const filters = (view: View.Node<any, any>) => Story.children(view, Filters)

describe("SearchPage", () => {
  it("keeps the last results up while the search text changes", () => {
    Story.make(SearchPageNoDeps, { route: route("hammer") }, (s) =>
      s
        .loaded("results", [page("hammer")])
        .loaded("unfiltered", [page("hammer")])
        .props({ route: route("drill") })
        .check((story) => assert.isUndefined(story.query(loading)))
        .view((view) => assert.strictEqual(filters(view).length, 1)),
    )
  })

  it("starts the filters over for another search", () => {
    const keys: Array<string> = []
    Story.make(SearchPageNoDeps, { route: route("hammer") }, (s) =>
      s
        .loaded("results", [page("hammer")])
        .loaded("unfiltered", [page("hammer")])
        .view((view) => keys.push(filters(view)[0].key))
        .props({ route: route("drill") })
        .view((view) => keys.push(filters(view)[0].key)),
    )
    // A new key mounts new filters, without what was typed under the last one
    assert.notStrictEqual(keys[0], keys[1])
  })
})
