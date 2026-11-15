import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { Router } from "@effect/ui"
import { Story } from "@effect/ui/testing"
import type { SearchRoute } from "../../routes.ts"
import { Filters, FiltersMessage } from "./Filters.ts"

const route = (query: SearchRoute["query"]): SearchRoute => ({
  _tag: "Search",
  params: {},
  query,
})

const price = { start: 0.5, end: 499.2 }
const hammer = { route: route({ query: "hammer" }), price }

const typed = (end: "min" | "max", text: string) =>
  FiltersMessage.make({ _tag: "PriceTyped", end, text })

const patch = (story: { readonly pending: ReadonlyArray<any> }) =>
  story.pending[0].command.args.patch

describe("Filters", () => {
  it("fills in the end that wasn't typed, and leaves its field empty", () => {
    Story.make(Filters, hammer, (s) =>
      s
        .send(typed("min", "10"))
        .send(FiltersMessage.make({ _tag: "PriceLeft", end: "min" }))
        .expectExact(Router.PatchQuery)
        .check((story) =>
          assert.deepStrictEqual(patch(story), { priceMin: 10, priceMax: 500 }),
        )
        .resolve(Router.PatchQuery, "navigated")
        // The search now has both ends, but only one was typed. The other
        // field is the one about to be typed in.
        .props({
          ...hammer,
          route: route({ query: "hammer", priceMin: 10, priceMax: 500 }),
        })
        .model((model) => assert.strictEqual(model.priceMax, ""))
        .send(typed("max", "50"))
        .send(FiltersMessage.make({ _tag: "PriceLeft", end: "max" }))
        .check((story) =>
          assert.deepStrictEqual(patch(story), { priceMin: 10, priceMax: 50 }),
        )
        .resolve(Router.PatchQuery, "navigated"),
    )
  })

  it("applies nothing on leaving a field that holds no number", () => {
    Story.make(Filters, hammer, (s) =>
      s
        .send(typed("max", "50"))
        .send(FiltersMessage.make({ _tag: "PriceLeft", end: "min" }))
        .expectNone()
        .send(typed("min", "abc"))
        .send(FiltersMessage.make({ _tag: "PriceLeft", end: "min" }))
        .expectNone(),
    )
  })

  it("keeps one rating thumb from passing the other", () => {
    Story.make(Filters, hammer, (s) =>
      s
        .send(
          FiltersMessage.make({ _tag: "RatingMoved", end: "max", value: 3 }),
        )
        .send(
          FiltersMessage.make({ _tag: "RatingMoved", end: "min", value: 4 }),
        )
        .model((model) => {
          assert.strictEqual(model.ratingMin, 3)
          assert.strictEqual(model.ratingMax, 3)
        })
        .send(FiltersMessage.make({ _tag: "RatingReleased" }))
        .check((story) =>
          assert.deepStrictEqual(patch(story), { ratingMin: 3, ratingMax: 3 }),
        )
        .resolve(Router.PatchQuery, "navigated"),
    )
  })
})
