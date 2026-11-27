import { Effect, Layer, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { Icon } from "../../design/icons.ts"
import { ProductCard } from "../../product/components/ProductCard.ts"
import { KnownProducts } from "../../product/services/KnownProducts.ts"
import { ListFavorites } from "../queries/ListFavorites.ts"
import { Favorites } from "../services/Favorites.ts"

export const FavoritesListMessage = UiSchema.TaggedEnum({
  ClickedClear: {},
})

/** Removes every favourite, on every device that syncs with this one. */
export class ClearFavorites extends Command.Service<ClearFavorites>()(
  "favorites/ClearFavorites",
) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const favorites = yield* Favorites
      return () => favorites.clear
    }),
  )
}

/** The favourites as a grid of product cards, newest first. */
export const FavoritesListNoDeps = Html.component({
  name: "FavoritesList",
  model: Schema.Struct({}),
  message: FavoritesListMessage,
  queries: {
    favorites: { query: ListFavorites, args: () => ({}) },
  },
}).make({
  init: () => ({}),
  update: ($, message) =>
    FavoritesListMessage.match(message, {
      ClickedClear: () => $.run(ClearFavorites.make()),
    }),
  view: (h) => {
    const favorites = AsyncResult.getOrElse(h.queries.favorites, () => [])
    if (favorites.length === 0) {
      return h.section
        .attr("aria-labelledby", "favourites-heading")
        .class(
          "flex flex-col items-center gap-2 rounded-xl bg-card/60 px-6 py-10 text-center",
        )
        .children(
          Icon(h, "star", { class: "size-7 text-accent" }),
          h.h2
            .id("favourites-heading")
            .class("font-bold")
            .children("No favourites yet"),
          h.p
            .class("max-w-xs text-sm text-muted-foreground")
            .children(
              "Tap the star on any product to keep it here for your next trip.",
            ),
        )
    }
    return h.section
      .attr("aria-labelledby", "favourites-heading")
      .class("w-full flex flex-col gap-4")
      .children(
        h.div.class("flex items-center justify-between gap-4").children(
          h.h2
            .id("favourites-heading")
            .class("flex items-center gap-2 text-lg font-bold text-primary")
            .children(
              "Favourites ",
              h.span
                .class(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold tabular-nums",
                )
                .children(String(favorites.length)),
            ),
          h.button
            .attr("type", "button")
            .class(
              "cursor-pointer rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            )
            .on("click", FavoritesListMessage.ClickedClear())
            .children("Clear all"),
        ),
        h.div
          .class(
            "grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
          )
          .children(
            favorites.map((product) =>
              ProductCard(h, {
                key: product.id,
                props: { product, query: "" },
              }),
            ),
          ),
      )
  },
})

export const FavoritesList = FavoritesListNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(ClearFavorites.layer, ListFavorites.layer).pipe(
      Layer.provide([Favorites.layer, KnownProducts.layer]),
    ),
  ),
)
