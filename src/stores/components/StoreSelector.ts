import { Effect, Layer, Option, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, UiSchema } from "@effect/ui"
import {
  SessionLocation,
  type Store,
} from "../../../server/src/domain/Bunnings.ts"
import { icon } from "../../design/icons.ts"
import { SessionTag } from "../../rpc/domain/SessionTag.ts"
import { Session } from "../../rpc/services/Session.ts"
import { CurrentStore } from "../queries/CurrentStore.ts"
import { NearbyStores } from "../queries/NearbyStores.ts"
import { StoreSearchPrompt } from "../services/StoreSearchPrompt.ts"

export const StoreSelectorMessage = UiSchema.TaggedEnum({
  Reached: {},
  StoreChosen: { location: SessionLocation },
  SearchOpened: {},
  /** The store the search came back with, or none when it was closed. */
  SearchAnswered: { store: Schema.Option(SessionLocation) },
})

/** Shops at a store: saves it and logs the session in with it. */
export class ChooseStore extends Command.Service<ChooseStore>()(
  "stores/ChooseStore",
  {
    args: { location: SessionLocation },
    // Prices and stock are per store
    invalidates: () => [SessionTag],
    // Shown as the store at once, until the session has it too
    optimistic: ({ location }) => [
      CurrentStore.patch({}, () => Option.some(location)),
    ],
  },
  Effect.gen(function* () {
    const session = yield* Session
    return ({ location }) =>
      Effect.as(session.setLocation(location), Component.noop)
  }),
) {}

/**
 * Opens the search of every store and waits for what it comes back with:
 * a store, or none when it is closed.
 */
export class SearchAllStores extends Command.Service<SearchAllStores>()(
  "stores/SearchAllStores",
  { args: {} },
  Effect.gen(function* () {
    const prompt = yield* StoreSearchPrompt
    return () =>
      Effect.map(prompt.ask, (store) =>
        StoreSelectorMessage.SearchAnswered({ store }),
      )
  }),
) {}

/**
 * Chooses the store to shop at: from the ten nearest, which asks for the
 * device's location, or by searching every store by hand.
 *
 * The nearest stores are a native `select`, so the keyboard and a phone's
 * own picker work without any handling here. Its list is styled where the
 * browser allows (`.store-select` in `index.css`). The chosen store is marked on
 * its `option`: a `value` on the `select` is set before it has options.
 *
 * The search is the last option of the list. It opens a drawer, which the
 * shell shows, and comes back with a store or without one. The host puts the
 * chosen store back on the `select` meanwhile, as the Model never chose the
 * search option.
 */
const searchValue = "search-all-stores"

export const StoreSelectorNoDeps = Component.define({
  name: "StoreSelector",
  scoped: false,
  model: Schema.Struct({
    /** Whether the nearby stores have been asked for. */
    nearbyWanted: Schema.Boolean,
  }),
  message: StoreSelectorMessage,
  queries: {
    current: { query: CurrentStore, args: () => ({}) },
    // Asking for nearby stores asks for the device's location, so it waits
    // until the picker is reached for
    nearby: {
      query: NearbyStores,
      args: (model) => (model.nearbyWanted ? {} : undefined),
    },
  },
}).make({
  init: () => ({ nearbyWanted: false }),
  update: (model, message, $) =>
    StoreSelectorMessage.match(message, {
      Reached: () =>
        model.nearbyWanted ? model : { ...model, nearbyWanted: true },
      StoreChosen: ({ location }) => $.run(ChooseStore.make({ location })),
      SearchOpened: () => $.run(SearchAllStores.make()),
      // The host hands focus back to the select that opened the search
      SearchAnswered: ({ store }) =>
        Option.match(store, {
          onNone: () => model,
          onSome: (location) => $.run(ChooseStore.make({ location })),
        }),
    }),
  view: (model, h) => {
    const shown = Option.flatten(AsyncResult.value(h.queries.current))
    const isShown = (code: string) =>
      Option.exists(shown, (location) => location.code === code)

    const nearby = Option.getOrElse(
      AsyncResult.value(h.queries.nearby),
      (): ReadonlyArray<Store> => [],
    )
    const nearbyStatus = !model.nearbyWanted
      ? ""
      : AsyncResult.match(h.queries.nearby, {
          onInitial: () => "Finding stores near you…",
          onFailure: () => "Couldn't find stores near you.",
          onSuccess: ({ value }) =>
            value.length === 0 ? "No stores found near you." : "",
        })

    return h.div.class("w-full").children(
      h.div.class("relative").children(
        icon(h, "mapPin", {
          class:
            "pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-accent",
        }),
        h.select
          .attr("aria-label", "Your store")
          .class(
            "store-select h-11 w-full cursor-pointer rounded-md border border-input bg-card py-2 pr-9 pl-10 text-sm font-medium outline-none transition-[color,box-shadow] hover:border-primary/40 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/15",
            Option.isNone(shown) ? "text-muted-foreground" : "text-foreground",
          )
          .onFocus(StoreSelectorMessage.Reached())
          // A press that opens a styled list focuses an option, not the select
          .onClick(StoreSelectorMessage.Reached())
          .onChange(({ value }) => {
            if (value === searchValue) {
              return StoreSelectorMessage.SearchOpened()
            }
            const store = nearby.find((store) => store.name === value)
            return store === undefined
              ? undefined
              : StoreSelectorMessage.StoreChosen({
                  location: SessionLocation.fromStore(store),
                })
          })
          .children(
            Option.match(shown, {
              onNone: () =>
                h.option
                  .attr("value", "")
                  .attr("hidden", "")
                  .disabled(true)
                  .selected(true)
                  .key("none")
                  .children("Select your store"),
              // A store chosen by search stays in the list when it isn't nearby
              onSome: (location) =>
                nearby.some((store) => store.name === location.code)
                  ? undefined
                  : h.option
                      .attr("value", location.code)
                      .selected(true)
                      .key(location.code)
                      .children(location.city),
            }),
            // In the list rather than beside it, so the page doesn't shift
            nearbyStatus !== "" &&
              h.option.disabled(true).key("status").children(nearbyStatus),
            nearby.length > 0 &&
              h.optgroup
                .attr("label", "Near you")
                .key("nearby")
                .children(
                  nearby.map((store) =>
                    h.option
                      .attr("value", store.name)
                      .selected(isShown(store.name))
                      .key(store.name)
                      .children(store.displayName),
                  ),
                ),
            (Option.isSome(shown) ||
              nearbyStatus !== "" ||
              nearby.length > 0) &&
              h.hr.key("search-separator"),
            h.option
              .attr("value", searchValue)
              .class("store-select-search")
              .key(searchValue)
              .children(
                icon(h, "search", { class: "size-4 shrink-0" }),
                "Search all stores",
              ),
          ),
        icon(h, "chevronDown", {
          class:
            "pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 opacity-50",
        }),
      ),
      h.p
        // Always here, so what it comes to say is announced
        .attr("aria-live", "polite")
        .class("sr-only")
        .children(nearbyStatus),
    )
  },
})

export const StoreSelector = StoreSelectorNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(
      CurrentStore.layer,
      NearbyStores.layer,
      ChooseStore.layer,
      SearchAllStores.layer,
    ).pipe(Layer.provide([Session.layer, StoreSearchPrompt.layer])),
  ),
)
