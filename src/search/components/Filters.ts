import { Schema } from "effect"
import { Command, Component, Router } from "@effect/ui"
import { DomCommand, Html } from "@effect/ui/html"
import { inputClass, labelClass } from "../../design/classes.ts"
import { AppRoute, SearchRoute } from "../../routes.ts"
import { FacetRange, ratingFacet } from "../domain/Search.ts"

const End = Schema.Literals(["min", "max"])

export const FiltersMessage = Schema.TaggedUnion({
  PriceTyped: { end: End, text: Schema.String },
  PriceLeft: { end: End },
  PriceSubmitted: {},
  RatingMoved: { end: End, value: Schema.Number },
  RatingReleased: {},
  Cleared: { filter: Schema.Literals(["price", "rating"]) },
})
const Message = FiltersMessage

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
type Model = typeof FiltersModel.Type

const parse = (text: string | null): number | undefined => {
  if (text === null || text.trim() === "") return undefined
  const value = Number(text)
  return Number.isNaN(value) ? undefined : value
}

const minRef = Html.ref("price-min", "input")
const maxRef = Html.ref("price-max", "input")

/** The rating range the slider shows: what is being dragged, else the URL's. */
const ratingRange = (model: Model, route: SearchRoute) => ({
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
export const Filters = Component.define({
  name: "Filters",
  scoped: false,
  props: Schema.Struct({
    route: SearchRoute,
    /** The range of prices in the search. Without one, no price filter. */
    price: Schema.NullOr(FacetRange),
  }),
  model: FiltersModel,
  message: Message,
}).make({
  init: () => ({
    priceMin: null,
    priceMax: null,
    ratingMin: null,
    ratingMax: null,
  }),
  update: (model, message, $) => {
    const { price, route } = $.props
    const { priceMax, priceMin, ratingMax, ratingMin } = route.search
    const patch = (query: Router.SearchPatch<SearchRoute>) =>
      Router.patchSearch(AppRoute, route, query).pipe(Command.asNoop)

    // An end that was never typed is filled in for the search, but its field
    // stays empty: it may be the one being typed in next
    const typedOnly: Model = {
      ...model,
      priceMin: model.priceMin ?? (priceMin === undefined ? "" : null),
      priceMax: model.priceMax ?? (priceMax === undefined ? "" : null),
    }

    return Message.match(message, {
      PriceTyped: ({ end, text }) =>
        end === "min"
          ? { ...model, priceMin: text }
          : { ...model, priceMax: text },
      PriceLeft: ({ end }) => {
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
      PriceSubmitted: () => {
        if (price === null) return model
        return $.set(typedOnly).run(
          patch({
            priceMin:
              parse(model.priceMin) ?? priceMin ?? Math.floor(price.start),
            priceMax: parse(model.priceMax) ?? priceMax ?? Math.ceil(price.end),
          }),
          DomCommand.blur(minRef, () => Component.noop),
          DomCommand.blur(maxRef, () => Component.noop),
        )
      },
      RatingMoved: ({ end, value }) => {
        const { max, min } = ratingRange(model, route)
        // One thumb can't pass the other
        return end === "min"
          ? { ...model, ratingMin: Math.min(value, max), ratingMax: max }
          : { ...model, ratingMin: min, ratingMax: Math.max(value, min) }
      },
      RatingReleased: () => {
        const { max, min } = ratingRange(model, route)
        return ratingMin === min && ratingMax === max
          ? model
          : $.run(patch({ ratingMin: min, ratingMax: max }))
      },
      Cleared: ({ filter }) =>
        filter === "price"
          ? $.set({ ...model, priceMin: null, priceMax: null }).run(
              patch({ priceMin: undefined, priceMax: undefined }),
            )
          : $.set({ ...model, ratingMin: null, ratingMax: null }).run(
              patch({ ratingMin: undefined, ratingMax: undefined }),
            ),
    })
  },
  view: (model, h) => {
    const { price, route } = h.props
    const { priceMax, priceMin, ratingMax, ratingMin } = route.search

    const heading = (name: string, filter: "price" | "rating", set: boolean) =>
      h.div.class("flex min-h-5 items-center justify-between gap-2").children(
        h.div.class(labelClass("text-foreground font-semibold")).children(name),
        set &&
          h.button
            .attr("type", "button")
            .class(
              "cursor-pointer rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )
            .onClick(Message.make({ _tag: "Cleared", filter }))
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
          Message.make({ _tag: "PriceTyped", end, text: value }),
        )
        .onBlur(Message.make({ _tag: "PriceLeft", end }))
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
                .onSubmit(Message.make({ _tag: "PriceSubmitted" }))
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
    const span = ratingFacet.end - ratingFacet.start
    // Where a thumb's centre sits: a native thumb stays inside the track, so
    // it travels the track's width less its own
    const offset = (value: number) => {
      const part = (value - ratingFacet.start) / span
      return { percent: part * 100, pixels: 12 - 24 * part }
    }
    const at = (value: number) => {
      const { percent, pixels } = offset(value)
      return `calc(${percent}% + ${pixels}px)`
    }
    const fromEnd = (value: number) => {
      const { percent, pixels } = offset(value)
      return `calc(${100 - percent}% - ${pixels}px)`
    }

    const ratingThumb = (end: "min" | "max", value: number) => [
      h.input
        .attr("type", "range")
        .attr("min", String(ratingFacet.start))
        .attr("max", String(ratingFacet.end))
        .attr("step", "1")
        .attr("aria-label", end === "min" ? "Minimum rating" : "Maximum rating")
        // With both thumbs at the top end, the lower one has to be on top or
        // neither could move
        .class(end === "min" && low === ratingFacet.end && "z-10")
        .value(String(value))
        .onInput(({ value }) =>
          Message.make({ _tag: "RatingMoved", end, value: Number(value) }),
        )
        .onChange(Message.make({ _tag: "RatingReleased" }))
        .key(end),
      h.output
        .style({ left: at(value) })
        .key(`${end}-value`)
        .children(String(value)),
    ]

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
          h.div
            .attr("role", "group")
            .attr("aria-label", "Rating")
            .class(
              "dual-range relative flex h-6 w-full touch-none items-center select-none",
            )
            .children(
              h.div
                .class(
                  "bg-primary/15 relative h-1.5 w-full grow overflow-hidden rounded-full",
                )
                .children(
                  h.div
                    .class("bg-secondary absolute h-full")
                    .attr("style", `left: ${at(low)}; right: ${fromEnd(high)}`),
                ),
              ratingThumb("min", low),
              ratingThumb("max", high),
            ),
        ),
      )

    return h.div
      .class(
        "grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl bg-card px-4 py-3 sm:grid-cols-2 sm:gap-y-4 sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,22rem)]",
      )
      .children(price !== null && priceFilter(price), ratingFilter)
  },
})
