import { Effect, Layer, Option, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component } from "@effect/ui"
import {
  SessionLocation,
  type Store,
} from "../../../server/src/domain/Bunnings.ts"
import { buttonClass, inputClass } from "../../design/classes.ts"
import { drawer, drawerHeader } from "../../design/drawer.ts"
import { icon } from "../../design/icons.ts"
import { skeleton } from "../../design/skeleton.ts"
import { Session } from "../../rpc/services/Session.ts"
import { AllStores } from "../queries/AllStores.ts"
import { CurrentStore } from "../queries/CurrentStore.ts"

export const StoreSearchMessage = Schema.TaggedUnion({
  SearchTyped: { text: Schema.String },
  StoreChosen: { location: SessionLocation },
  Closed: {},
  Retried: {},
})
const Message = StoreSearchMessage

export const StoreSearchEvents = Schema.TaggedUnion({
  /** The store that was picked, or none when the search was closed. */
  Answered: { store: Schema.Option(SessionLocation) },
})

/** Loads the list of every store again, after it failed. */
export class RetryAllStores extends Command.Service<RetryAllStores>()(
  "stores/RetryAllStores",
  { args: {}, invalidates: () => [AllStores] },
  Effect.succeed(() => Effect.succeed(Component.noop)),
) {}

const matches = (store: Store, terms: ReadonlyArray<string>) => {
  const text = [
    store.displayName,
    store.address.town,
    store.address.postalCode,
    store.storeRegion,
    store.address.country.name,
  ]
    .join(" ")
    .toLowerCase()
  return terms.every((term) => text.includes(term))
}

/**
 * The drawer that searches every store by hand. Mount it outside the page it
 * covers, while it is open and then until the drawer has left. It reports
 * the store that was picked, or that it was closed, and leaves choosing the
 * store to whoever asked.
 */
export const StoreSearchNoDeps = Component.define({
  name: "StoreSearch",
  scoped: false,
  props: Schema.Struct({ open: Schema.Boolean }),
  model: Schema.Struct({
    search: Schema.String,
  }),
  message: Message,
  events: StoreSearchEvents,
  queries: {
    current: { query: CurrentStore, args: () => ({}) },
    all: { query: AllStores, args: () => ({}) },
  },
}).make({
  init: () => ({ search: "" }),
  update: (model, message, $) =>
    Message.match(message, {
      SearchTyped: ({ text }) => ({ ...model, search: text }),
      StoreChosen: ({ location }) =>
        $.set(model).emit(
          StoreSearchEvents.make({
            _tag: "Answered",
            store: Option.some(location),
          }),
        ),
      Closed: () =>
        $.set(model).emit(
          StoreSearchEvents.make({ _tag: "Answered", store: Option.none() }),
        ),
      Retried: () => $.run(RetryAllStores.make()),
    }),
  view: (model, h) => {
    const current = Option.flatten(AsyncResult.value(h.queries.current))
    const isShown = (code: string) =>
      Option.exists(current, (location) => location.code === code)
    const terms = model.search.toLowerCase().split(/\s+/).filter(Boolean)
    return drawer(
      h,
      {
        titleId: "store-search-title",
        open: h.props.open,
        onClose: Message.make({ _tag: "Closed" }),
        class: "h-[80vh]",
      },
      drawerHeader(
        h,
        { titleId: "store-search-title", title: "Find your store" },
        "Search Bunnings stores in New Zealand and Australia.",
      ),
      h.div.class("flex flex-col min-h-0 flex-1").children(
        h.div.class("px-4 pb-2 relative").children(
          icon(h, "search", {
            class:
              "absolute left-7 top-1/2 -translate-y-1/2 -mt-1 size-4 text-muted-foreground",
          }),
          h.input
            .attr("autofocus", "")
            .attr("type", "search")
            .attr("aria-label", "Search stores")
            .attr("placeholder", "Store, suburb or postcode")
            .class(inputClass("pl-9"))
            .value(model.search)
            .onInput(({ value }) =>
              Message.make({ _tag: "SearchTyped", text: value }),
            ),
        ),
        h.div.class("overflow-y-auto flex-1 px-4 pb-safe").children(
          AsyncResult.match(h.queries.all, {
            onInitial: () =>
              [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
                skeleton(h, "h-12 my-2").key(`skeleton-${i}`),
              ),
            onFailure: () =>
              h.div
                .class(
                  "flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground",
                )
                .children(
                  h.p.attr("role", "status").children("Couldn't load stores."),
                  h.button
                    .attr("type", "button")
                    .class(buttonClass({ variant: "outline" }))
                    .onClick(Message.make({ _tag: "Retried" }))
                    .children("Try again"),
                ),
            onSuccess: ({ value: stores }) => {
              const found = stores.filter((store) => matches(store, terms))
              if (found.length === 0) {
                return h.p
                  .attr("role", "status")
                  .class("py-8 text-center text-sm text-muted-foreground")
                  .children(`No stores match “${model.search.trim()}”.`)
              }
              const countries = new Map<string, Array<Store>>()
              for (const store of found) {
                const country = store.address.country.name
                countries.set(country, [
                  ...(countries.get(country) ?? []),
                  store,
                ])
              }
              for (const stores of countries.values()) {
                stores.sort((a, b) =>
                  a.displayName.localeCompare(b.displayName),
                )
              }
              const item = (store: Store) => {
                const button = h.button
                  .attr("type", "button")
                  .attr(
                    "aria-current",
                    isShown(store.name) ? "true" : undefined,
                  )
                  .class(
                    "flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                  )
                  .onClick(
                    Message.make({
                      _tag: "StoreChosen",
                      location: SessionLocation.fromStore(store),
                    }),
                  )
                  .children(
                    icon(h, "mapPin", {
                      class: "size-4 shrink-0 text-accent",
                    }),
                    h.span
                      .class("flex min-w-0 flex-1 flex-col")
                      .children(
                        h.span
                          .class("font-medium text-primary")
                          .children(store.displayName),
                        h.span
                          .class("truncate text-xs text-muted-foreground")
                          .children(store.address.formattedAddress),
                      ),
                    isShown(store.name) &&
                      icon(h, "check", { class: "size-4 text-primary" }),
                  )
                return h.li.key(store.name).children(button)
              }
              return Array.from(countries, ([country, stores]) =>
                h.section
                  .attr("aria-label", country)
                  .class("pb-4")
                  .key(country)
                  .children(
                    h.h3
                      .class(
                        "sticky top-0 bg-background py-2 text-sm font-semibold text-primary",
                      )
                      .children(country),
                    h.ul.class("flex flex-col").children(stores.map(item)),
                  ),
              )
            },
          }),
        ),
      ),
    )
  },
})

export const StoreSearch = StoreSearchNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(
      CurrentStore.layer,
      AllStores.layer,
      RetryAllStores.layer,
    ).pipe(Layer.provide(Session.layer)),
  ),
)
