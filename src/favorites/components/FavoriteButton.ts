import { Effect, Layer, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { buttonClass } from "../../design/classes.ts"
import { icon } from "../../design/icons.ts"
import { KnownProducts } from "../../product/services/KnownProducts.ts"
import { ListFavorites } from "../loaders/ListFavorites.ts"
import { Favorites } from "../services/Favorites.ts"

export const FavoriteButtonMessage = Schema.TaggedUnion({
  Toggled: {},
})

/** Adds a product to the favourites, or removes it if it is one already. */
export class ToggleFavorite extends Command.Service<ToggleFavorite>()(
  "favorites/ToggleFavorite",
  {
    // Invalidates nothing: the favourites refetch themselves after every
    // change.
    args: { product: ProductBaseInfo },
  },
  Effect.gen(function* () {
    const favorites = yield* Favorites
    return ({ product }) => Effect.as(favorites.toggle(product), Component.noop)
  }),
) {}

/**
 * The star that makes a product a favourite. `icon` is the round one on a
 * product card, `button` the labelled one on a product page.
 */
export const FavoriteButtonNoDeps = Component.define({
  name: "FavoriteButton",
  props: Schema.Struct({
    product: ProductBaseInfo,
    variant: Schema.Literals(["icon", "button"]),
  }),
  model: Schema.Struct({}),
  message: FavoriteButtonMessage,
  loaders: {
    favorites: { load: ListFavorites, args: () => ({}) },
  },
}).make({
  init: () => ({}),
  update: (_model, message, $) =>
    FavoriteButtonMessage.match(message, {
      Toggled: () => $.run(ToggleFavorite.make({ product: $.props.product })),
    }),
  view: (_model, h) => {
    const { product, variant } = h.props
    const isFavorite = AsyncResult.getOrElse(h.loaded.favorites, () => []).some(
      (favorite) => favorite.id === product.id,
    )
    const toggled = FavoriteButtonMessage.make({ _tag: "Toggled" })
    if (variant === "icon") {
      return h.button
        .attr("type", "button")
        .attr("aria-label", "Toggle favorite")
        .attr("aria-pressed", String(isFavorite))
        .class(
          "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-card/90 transition-[background-color,transform] hover:bg-muted active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )
        .onClick(toggled)
        .children(
          icon(h, "star", {
            class: Html.classNames(
              "size-5 text-accent",
              isFavorite ? "fill-accent" : "fill-none",
            ),
          }),
        )
    }
    return h.button
      .attr("type", "button")
      .class(
        buttonClass({
          variant: "outline",
          size: "lg",
          class: "cursor-pointer",
        }),
      )
      .onClick(toggled)
      .children(
        icon(h, "star", {
          class: Html.classNames(
            "text-accent transition-transform",
            isFavorite ? "fill-accent scale-110" : "fill-none",
          ),
        }),
        isFavorite ? "Unfavorite" : "Favorite",
      )
  },
})

export const FavoriteButton = FavoriteButtonNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(ToggleFavorite.layer, ListFavorites.layer).pipe(
      Layer.provide([Favorites.layer, KnownProducts.layer]),
    ),
  ),
)
