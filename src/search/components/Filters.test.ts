import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Router } from "@effect/ui"
import { Story } from "@effect/ui/testing"
import type { SearchRoute } from "../../routes.ts"
import { Filters, FiltersMessage } from "./Filters.ts"

const route = (search: SearchRoute["search"]): SearchRoute => ({
  _tag: "Search",
  params: {},
  search,
})

const price = { start: 0.5, end: 499.2 }
const hammer = { route: route({ query: "hammer" }), price }

const typed = (end: "min" | "max", text: string) =>
  FiltersMessage.UpdatedPrice({ end, text })

const patch = (story: { readonly pending: ReadonlyArray<any> }) =>
  story.pending[0].command.args.patch

describe("Filters", () => {
  it.effect(
    "fills in the end that wasn't typed, and leaves its field empty",
    () =>
      Effect.gen(function* () {
        const s = yield* Story.make(Filters, hammer)
        s.send(typed("min", "10"))
          .send(FiltersMessage.BlurredPrice({ end: "min" }))
          .expectExact(Router.PatchSearch)
        assert.deepStrictEqual(patch(s), { priceMin: 10, priceMax: 500 })
        s.resolve(Router.PatchSearch, "navigated")
          // The search now has both ends, but only one was typed. The other
          // field is the one about to be typed in.
          .props({
            ...hammer,
            route: route({ query: "hammer", priceMin: 10, priceMax: 500 }),
          })
        assert.strictEqual(s.model.priceMax, "")
        s.send(typed("max", "50")).send(
          FiltersMessage.BlurredPrice({ end: "max" }),
        )
        assert.deepStrictEqual(patch(s), { priceMin: 10, priceMax: 50 })
        s.resolve(Router.PatchSearch, "navigated")
      }),
  )

  it.effect("applies nothing on leaving a field that holds no number", () =>
    Effect.gen(function* () {
      const s = yield* Story.make(Filters, hammer)
      s.send(typed("max", "50"))
        .send(FiltersMessage.BlurredPrice({ end: "min" }))
        .expectNone()
        .send(typed("min", "abc"))
        .send(FiltersMessage.BlurredPrice({ end: "min" }))
        .expectNone()
    }),
  )

  it.effect("applies the rating range once the slider is let go", () =>
    Effect.gen(function* () {
      const s = yield* Story.make(Filters, hammer)
      s.send(FiltersMessage.MovedRating({ min: 3, max: 5 }))
        .expectNone()
        .send(FiltersMessage.CommittedRating({ min: 3, max: 5 }))
      assert.deepStrictEqual(patch(s), { ratingMin: 3, ratingMax: 5 })
      s.resolve(Router.PatchSearch, "navigated")
    }),
  )
})
