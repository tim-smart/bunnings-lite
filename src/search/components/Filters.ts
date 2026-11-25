import { Schema } from "effect"
import { Command, Component, Router, UiSchema, UiStruct } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import { Slider } from "@effect/ui-kit"
import { inputClass, labelClass } from "../../design/classes.ts"
import { AppRoute, SearchRoute } from "../../routes.ts"
import { FacetRange, ratingFacet } from "../domain/Search.ts"

const End = Schema.Literals(["min", "max"])

export const FiltersMessage = UiSchema.TaggedEnum({
  UpdatedPrice: { end: End, text: Schema.String },
  BlurredPrice: { end: End },
  SubmittedPrice: {},
  MovedRating: { min: Schema.Number, max: Schema.Number },
  CommittedRating: { min: Schema.Number, max: Schema.Number },
  ClickedClear: { filter: Schema.Literals(["price", "rating"]) },
})

/**
 * What is being typed and dragged, before it is applied. An end that is
 * `null` hasn't been touched, and shows the filter in the URL.
 */
const FiltersModel = Schema.Struct({
  priceMin: Schema.NullOr(Schema.String),
  priceMax: Schema.NullOr(Schema.String),
  ratingMin: Schema.NullOr(Schema.Number),
  ratingMax: Schema.NullOr(Schema.Number),
})
type FiltersModel = typeof FiltersModel.Type

const parse = (text: string | null): number | undefined => {
  if (text === null || text.trim() === "") return undefined
  const value = Number(text)
  return Number.isNaN(value) ? undefined : value
}

const minRef = Html.ref("price-min", "input")
const maxRef = Html.ref("price-max", "input")

/** The rating range the slider shows: what is being dragged, else the URL's. */
const ratingRange = (model: FiltersModel, route: SearchRoute) => ({
  min: model.ratingMin ?? route.search.ratingMin ?? ratingFacet.start,
  max: model.ratingMax ?? route.search.ratingMax ?? ratingFacet.end,
})

/**
 * The price and rating filters of a search. Edits stay here until they are
 * applied, which writes the filter to the URL: a price on Enter or on leaving
 * a field, a rating on letting go of the slider.
 *
 * Its parent keys it by the search text, so edits that weren't applied don't
 * carry to another search.
 */
export const Filters = Html.component({
  name: "Filters",
  props: Schema.Struct({
    route: SearchRoute,
    /** The range of prices in the search. Without one, no price filter. */
    price: Schema.NullOr(FacetRange),
  }),
  model: FiltersModel,
  message: FiltersMessage,
}).make({
  init: () => ({
    priceMin: null,
    priceMax: null,
    ratingMin: null,
    ratingMax: null,
  }),
  update: ($, message) => {
    const { model } = $
    const { price, route } = $.props
    const { priceMax, priceMin, ratingMax, ratingMin } = route.search
    const patch = (query: Router.SearchPatch<SearchRoute>) =>
      Router.patchSearch(AppRoute, route, query).pipe(Command.asNoop)

    // An end that was never typed is filled in for the search, but its field
    // stays empty: it may be the one being typed in next
    const typedOnly = UiStruct.evolve(model, {
      priceMin: (typed) => typed ?? (priceMin === undefined ? "" : null),
      priceMax: (typed) => typed ?? (priceMax === undefined ? "" : null),
    })

    return FiltersMessage.match(message, {
      UpdatedPrice: ({ end, text }) =>
        end === "min"
          ? $.evolve({ priceMin: text })
          : $.evolve({ priceMax: text }),
      BlurredPrice: ({ end }) => {
        if (price === null) return model
        const typedMin = parse(model.priceMin)
        const typedMax = parse(model.priceMax)
        // Leaving a field that holds no number applies nothing
        if ((end === "min" ? typedMin : typedMax) === undefined) return model
        const min = typedMin ?? priceMin ?? Math.floor(price.start)
        const max = typedMax ?? priceMax ?? Math.ceil(price.end)
        return priceMin === min && priceMax === max
          ? model
          : $.set(typedOnly).run(patch({ priceMin: min, priceMax: max }))
      },
      SubmittedPrice: () => {
        if (price === null) return model
        return $.set(typedOnly).run(
          patch({
            priceMin:
              parse(model.priceMin) ?? priceMin ?? Math.floor(price.start),
            priceMax: parse(model.priceMax) ?? priceMax ?? Math.ceil(price.end),
          }),
          HtmlCommand.blur(minRef, () => Component.noop),
          HtmlCommand.blur(maxRef, () => Component.noop),
        )
      },
      MovedRating: ({ max, min }) =>
        $.evolve({
          ratingMin: min,
          ratingMax: max,
        }),
      CommittedRating: ({ max, min }) =>
        ratingMin === min && ratingMax === max
          ? $.evolve({ ratingMin: min, ratingMax: max })
          : $.evolve({ ratingMin: min, ratingMax: max }).run(
              patch({ ratingMin: min, ratingMax: max }),
            ),
      ClickedClear: ({ filter }) =>
        filter === "price"
          ? $.evolve({ priceMin: null, priceMax: null }).run(
              patch({ priceMin: undefined, priceMax: undefined }),
            )
          : $.evolve({ ratingMin: null, ratingMax: null }).run(
              patch({ ratingMin: undefined, ratingMax: undefined }),
            ),
    })
  },
  view: (h, model) => {
    const { price, route } = h.props
    const { priceMax, priceMin, ratingMax, ratingMin } = route.search

    const heading = (name: string, filter: "price" | "rating", set: boolean) =>
      h.div
        .class("flex min-h-5 items-center justify-between gap-2")
        .children(
          h.div
            .class(labelClass("text-foreground font-semibold"))
            .children(name),
          set &&
            h.button
              .attr("type", "button")
              .class(
                "cursor-pointer rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              )
              .onClick(FiltersMessage.ClickedClear({ filter }))
              .children("(clear)"),
        )

    const priceInput = (end: "min" | "max", range: FacetRange) => {
      const edit = end === "min" ? model.priceMin : model.priceMax
      const applied = end === "min" ? priceMin : priceMax
      return h.input
        .ref(end === "min" ? minRef : maxRef)
        .attr("type", "number")
        .attr("inputmode", "decimal")
        .attr("aria-label", end === "min" ? "Minimum price" : "Maximum price")
        .attr(
          "placeholder",
          end === "min"
            ? `$${Math.floor(range.start)}`
            : `$${Math.ceil(range.end)}`,
        )
        .class(inputClass("tabular-nums"))
        .value(edit ?? (applied === undefined ? "" : String(applied)))
        .onInput(({ value }) =>
          FiltersMessage.UpdatedPrice({ end, text: value }),
        )
        .onBlur(FiltersMessage.BlurredPrice({ end }))
    }

    const priceFilter = (range: FacetRange) =>
      h.div
        .class("flex flex-col gap-1.5")
        .key("price")
        .children(
          heading(
            "Price",
            "price",
            priceMin !== undefined && priceMax !== undefined,
          ),
          h.div
            .class("flex-1 flex items-center min-h-10 px-1 sm:px-0")
            .children(
              h.form
                .class("w-full")
                .onSubmit(FiltersMessage.SubmittedPrice())
                .children(
                  h.div
                    .class("flex gap-3 items-center")
                    .children(
                      priceInput("min", range),
                      h.span
                        .class("shrink-0 text-sm text-muted-foreground")
                        .children("to"),
                      priceInput("max", range),
                    ),
                  // Enter submits a form with two fields only when it has a
                  // submit button
                  h.button
                    .attr("type", "submit")
                    .class("hidden")
                    .children("Submit"),
                ),
            ),
        )

    const { max: high, min: low } = ratingRange(model, route)
    // The slider sorts its values and keeps one thumb from passing the other
    const rating = (value: number | ReadonlyArray<number>) => {
      const [min = low, max = high] = typeof value === "number" ? [] : value
      return { min, max }
    }

    const ratingFilter = h.div
      .class("flex flex-col gap-1.5")
      .key("rating")
      .children(
        heading(
          "Rating",
          "rating",
          ratingMin !== undefined && ratingMax !== undefined,
        ),
        h.div.class("flex-1 flex items-center min-h-10 px-1 sm:px-0").children(
          Slider(h, {
            props: {
              value: [low, high],
              min: ratingFacet.start,
              max: ratingFacet.end,
              step: 1,
              largeStep: 1,
            },
            onEmit: {
              Moved: ({ value }) =>
                FiltersMessage.MovedRating({ ...rating(value) }),
              Committed: ({ value }) =>
                FiltersMessage.CommittedRating({ ...rating(value) }),
            },
            view: (slider) => {
              const thumb = (index: 0 | 1, value: number) =>
                slider
                  .thumb({
                    element: h.div.class("rating-thumb"),
                    input: h.input.attr(
                      "aria-label",
                      index === 0 ? "Minimum rating" : "Maximum rating",
                    ),
                    index,
                  })
                  .children(
                    h.span
                      .class("rating-value")
                      .attr("aria-hidden", "true")
                      .children(String(value)),
                  )
              return slider
                .root(
                  h.div
                    .attr("aria-label", "Rating")
                    .class("rating-slider w-full px-3"),
                )
                .children(
                  slider
                    .control(
                      h.div.class(
                        "flex h-6 w-full touch-none items-center select-none",
                      ),
                    )
                    .children(
                      slider
                        .track(
                          h.div.class(
                            "bg-primary/15 relative h-1.5 w-full rounded-full",
                          ),
                        )
                        .children(
                          slider.indicator(
                            h.div.class(
                              "bg-secondary absolute inset-y-0 left-(--slider-indicator-start) w-(--slider-indicator-size) rounded-full",
                            ),
                          ),
                          thumb(0, low),
                          thumb(1, high),
                        ),
                    ),
                )
            },
          }),
        ),
      )

    return h.div
      .class(
        "grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl bg-card px-4 py-3 sm:grid-cols-2 sm:gap-y-4 sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,22rem)]",
      )
      .children(price !== null && priceFilter(price), ratingFilter)
  },
})
