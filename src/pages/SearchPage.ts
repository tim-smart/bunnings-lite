import { Array as Arr, Cause, Layer, Option, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Component, Head } from "@effect/ui"
import type { ProductBaseInfo } from "../../server/src/domain/Bunnings.ts"
import { InstallButton } from "../browser/components/InstallButton.ts"
import {
  bottomReached,
  hasMore,
  scrolledPast,
} from "../browser/subscriptions.ts"
import { buttonClass } from "../design/classes.ts"
import { icon } from "../design/icons.ts"
import { skeleton } from "../design/skeleton.ts"
import { FavoritesList } from "../favorites/components/FavoritesList.ts"
import { ObserveSize, VirtualList } from "../kit/VirtualList.ts"
import { ProductCard } from "../product/components/ProductCard.ts"
import { KnownProducts } from "../product/services/KnownProducts.ts"
import { SearchRoute } from "../routes.ts"
import { Session } from "../rpc/services/Session.ts"
import { Filters } from "../search/components/Filters.ts"
import {
  priceFacet,
  searchArgs,
  searchDebounce,
} from "../search/domain/Search.ts"
import { SearchProducts } from "../search/queries/SearchProducts.ts"
import { StoreSelector } from "../stores/components/StoreSelector.ts"

export const SearchPageMessage = Schema.TaggedUnion({
  BottomReached: {},
  Scrolled: { scrolled: Schema.Boolean },
  SearchWanted: {},
})
const Message = SearchPageMessage

/** Asks whoever holds the search box to bring it back into reach. */
export const SearchPageEvents = Schema.TaggedUnion({ SearchWanted: {} })

const gridClass =
  "grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4"

/**
 * The home page. With no search text it shows the store and the favourites,
 * otherwise the results of the search in the URL, a page at a time as the
 * page is scrolled.
 */
export const SearchPageNoDeps = Component.define({
  name: "SearchPage",
  props: Schema.Struct({ route: SearchRoute }),
  model: Schema.Struct({ scrolled: Schema.Boolean }),
  message: Message,
  events: SearchPageEvents,
  queries: {
    results: {
      query: SearchProducts,
      debounce: searchDebounce,
      args: (_model, props) => searchArgs(props.route),
    },
    // The search without its filters, whose first page gives the ranges the
    // filters can take: applying a filter narrows what the server reports.
    // With no filter applied it is the same read as `results`.
    unfiltered: {
      query: SearchProducts,
      debounce: searchDebounce,
      args: (_model, props) => {
        const args = searchArgs(props.route)
        return args && { ...args, price: null, rating: null }
      },
    },
  },
}).make({
  init: () => ({ scrolled: false }),
  update: (model, message, $) =>
    Message.match(message, {
      BottomReached: () =>
        hasMore($.queries.results) ? $.loadMore("results") : model,
      Scrolled: ({ scrolled }) => ({ ...model, scrolled }),
      SearchWanted: () =>
        $.set(model).emit(SearchPageEvents.make({ _tag: "SearchWanted" })),
    }),
  subscriptions: (_model, props) => {
    if (searchArgs(props.route) === undefined) return []
    return [
      bottomReached(Message.make({ _tag: "BottomReached" })),
      scrolledPast(200, (scrolled) =>
        Message.make({ _tag: "Scrolled", scrolled }),
      ),
    ]
  },
  head: (_model, props) => {
    const query = props.route.search.query.trim()
    return query === "" ? [] : [Head.title(query)]
  },
  view: (model, h) => {
    const { route } = h.props
    const args = searchArgs(route)

    if (args === undefined) {
      return h.div
        .class("flex flex-col pt-6 pb-10 gap-8 sm:pt-8 sm:gap-10")
        .key("home")
        .children(
          h.section
            .attr("aria-labelledby", "store-heading")
            .class(
              "grid gap-4 rounded-xl bg-card p-4 sm:p-6 md:grid-cols-[1fr_minmax(0,24rem)] md:items-center md:gap-8",
            )
            .children(
              h.div
                .class("flex flex-col gap-1")
                .children(
                  h.h2
                    .id("store-heading")
                    .class("text-lg font-bold text-primary")
                    .children("Your store"),
                  h.p
                    .class("text-sm text-muted-foreground")
                    .children(
                      "Stock levels and aisle locations are shown for this store.",
                    ),
                ),
              StoreSelector(h, { key: "store" }),
            ),
          FavoritesList(h, { key: "favorites" }),
          h.div
            .class("fixed bottom-0 right-0 p-4 pb-safe flex flex-col")
            .children(InstallButton(h, { key: "install" }), h.div.class("h-4")),
        )
    }

    const skeletons = () =>
      h.div
        .class(gridClass)
        .attr("role", "status")
        .attr("aria-label", "Loading results")
        .children(
          [0, 1, 2, 3, 4, 5, 6, 7].map((i) =>
            h.div
              .class("flex flex-col gap-3 rounded-xl bg-card p-3 sm:p-4")
              .key(String(i))
              .children(
                skeleton(h, "h-28 w-full sm:h-44"),
                skeleton(h, "h-4 w-full"),
                skeleton(h, "h-4 w-2/3"),
                skeleton(h, "h-6 w-1/3"),
              ),
          ),
        )

    const noResults = () =>
      h.div
        .class(
          "flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-14 text-center",
        )
        .children(
          icon(h, "searchX", { class: "size-8 text-primary/60" }),
          h.h2.class("text-lg font-bold").children("No results found."),
          h.p
            .class("text-sm text-muted-foreground")
            .children("Check the spelling or try a broader term."),
          h.button
            .attr("type", "button")
            .class(buttonClass({ class: "mt-3" }))
            .onClick(Message.make({ _tag: "SearchWanted" }))
            .children("Try another search"),
        )

    // `search` names the search the items answer. The last search's items
    // have none, so the list keeps what it measured until the next arrive.
    const grid = (items: ReadonlyArray<ProductBaseInfo>, search?: string) =>
      items.length === 0
        ? noResults()
        : // Only the cards near the window are rendered
          VirtualList(h, {
            key: "results",
            props: {
              count: items.length,
              estimatedRowSize: 350,
              initialCount: 16,
              dataset: search,
            },
            view: (list) =>
              list.list(h.div.class(gridClass)).children(
                list.items.map((index) => {
                  const product = items[index]
                  return list
                    .item(h.div.key(product.id).class("grid min-w-0"), index)
                    .children(
                      ProductCard(h, {
                        key: product.id,
                        props: { product, query: route.search.query },
                      }),
                    )
                }),
              ),
          })

    const results = AsyncResult.match(h.queries.results, {
      // The last results stay up while the next ones load
      onInitial: () =>
        Option.match(h.previous.results, {
          onNone: skeletons,
          onSome: ({ items }) => grid(items),
        }),
      onFailure: ({ cause }) =>
        h.div
          .class(
            "flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-12 text-center",
          )
          .children(
            h.h2
              .class("text-lg font-bold text-accent")
              .children("An error occurred while fetching results."),
            h.pre
              .class(
                "max-w-full overflow-x-auto whitespace-pre-wrap text-left text-xs text-muted-foreground",
              )
              .children(Cause.pretty(cause)),
          ),
      onSuccess: ({ value }) => grid(value.items, JSON.stringify(args)),
    })

    // The last search's ranges stay up while the next one's load
    const firstPage = Option.flatMap(
      Option.orElse(
        AsyncResult.value(h.queries.unfiltered),
        () => h.previous.unfiltered,
      ),
      ({ pages }) => Arr.head(pages),
    )

    return h.div.key("results").children(
      h.div.class("h-4 sm:h-6"),
      Option.isSome(firstPage) &&
        Filters(h, {
          // Edits that weren't applied don't carry to another search
          key: `filters:${route.search.query}`,
          props: { route, price: priceFacet(firstPage.value) },
        }),
      h.div.class("h-3 sm:h-4"),
      results,
      h.div
        .class("fixed bottom-0 right-0 p-6 pb-safe flex flex-col transform-gpu")
        .children(
          model.scrolled &&
            h.button
              .attr("type", "button")
              .attr("aria-label", "Back to top")
              .class(
                buttonClass({
                  class:
                    "size-12 cursor-pointer rounded-full shadow-lg shadow-primary/25 animate-in fade-in zoom-in-90",
                }),
              )
              .onClick(Message.make({ _tag: "SearchWanted" }))
              .children(
                icon(h, "arrowUp", { class: "size-5", strokeWidth: 2.5 }),
              ),
          h.div.class("h-6"),
        ),
    )
  },
})

export const SearchPage = SearchPageNoDeps.pipe(
  Component.provide([
    SearchProducts.layer.pipe(
      Layer.provide([Session.layer, KnownProducts.layer]),
    ),
    ObserveSize.layer,
  ]),
)
