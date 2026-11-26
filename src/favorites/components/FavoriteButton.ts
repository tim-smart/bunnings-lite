import { Effect, Layer, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { Toggle } from "@effect/ui-kit"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { buttonClass } from "../../design/classes.ts"
import { Icon } from "../../design/icons.ts"
import { KnownProducts } from "../../product/services/KnownProducts.ts"
import { ListFavorites } from "../queries/ListFavorites.ts"
import { Favorites } from "../services/Favorites.ts"

export const FavoriteButtonMessage = UiSchema.TaggedEnum({
  ToggledFavorite: {},
})

/** Adds a product to the favourites, or removes it if it is one already. */
export class ToggleFavorite extends Command.Service<ToggleFavorite>()(
  "favorites/ToggleFavorite",
  {
    // Invalidates nothing: the favourites refetch themselves after every
    // change.
    args: { product: ProductBaseInfo },
    success: Component.Noop,
  },
) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const favorites = yield* Favorites
      return ({ product }) =>
        Effect.as(favorites.toggle(product), Component.noop)
    }),
  )
}

/**
 * The star that makes a product a favourite. `icon` is the round one on a
 * product card, `button` the labelled one on a product page.
 */
export const FavoriteButtonNoDeps = Html.component({
  name: "FavoriteButton",
  props: Schema.Struct({
    product: ProductBaseInfo,
    variant: Schema.Literals(["icon", "button"]),
  }),
  model: Schema.Struct({}),
  message: FavoriteButtonMessage,
  queries: {
    favorites: { query: ListFavorites, args: () => ({}) },
  },
}).make({
  init: () => ({}),
  update: ($, message) =>
    FavoriteButtonMessage.match(message, {
      ToggledFavorite: () =>
        $.run(ToggleFavorite.make({ product: $.props.product })),
    }),
  view: (h) => {
    const { product, variant } = h.props
    const isFavorite = AsyncResult.getOrElse(
      h.queries.favorites,
      () => [],
    ).some((favorite) => favorite.id === product.id)
    const toggled = FavoriteButtonMessage.ToggledFavorite()
    if (variant === "icon") {
      return Toggle(h, {
        props: { pressed: isFavorite },
        onToggle: () => toggled,
      })
        .attr("type", "button")
        .attr("aria-label", "Toggle favorite")
        .class(
          "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-card/90 transition-[background-color,transform] hover:bg-muted active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )
        .children(
          Icon(h, "star", {
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
      .on("click", toggled)
      .children(
        Icon(h, "star", {
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
