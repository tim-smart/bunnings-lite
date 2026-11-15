import { Schema } from "effect"
import { Component } from "@effect/ui"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { cardClass } from "../../design/classes.ts"
import { starRating } from "../../design/starRating.ts"
import { FavoriteButton } from "../../favorites/components/FavoriteButton.ts"
import { formatPrice } from "../../lib/utils.ts"
import { productUrl } from "../../routes.ts"
import { FulfillmentBadge } from "./FulfillmentBadge.ts"

/**
 * A product in a grid: a link to its page, with its stock badge and the
 * favourite star. The star sits beside the link, not inside it, so pressing
 * it doesn't follow the link.
 */
export const ProductCard = Component.define({
  name: "ProductCard",
  props: Schema.Struct({
    product: ProductBaseInfo,
    /** The search the card is shown under, which its link keeps. */
    query: Schema.String,
  }),
  model: Schema.Struct({}),
  message: Schema.Never,
}).make({
  init: () => ({}),
  update: (model) => model,
  view: (_model, h) => {
    const { product, query } = h.props
    return h.article.class("group relative min-w-0").children(
      h.a
        .attr("href", productUrl(product.id, query))
        .class(
          "block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary/40",
        )
        .children(
          h.div
            .class(
              cardClass(
                "@container/card relative h-full gap-0 overflow-hidden py-0 transition-[box-shadow] group-hover:ring-2 group-hover:ring-primary/15",
              ),
            )
            .children(
              // Product photos are shot on white, so they sit in a light
              // well that the dark theme keeps instead of leaving ragged
              // white rectangles
              h.div
                .class("h-36 px-3 pt-10 pb-2 sm:h-52 sm:px-4")
                .children(
                  h.div
                    .class(
                      "flex h-full items-center justify-center overflow-hidden rounded-lg bg-image-well px-1 text-image-well-foreground sm:px-2",
                    )
                    .children(
                      h.img
                        .attr("src", product.images[0].thumbnailUrl)
                        .attr("alt", product.title)
                        .attr("loading", "lazy")
                        .class(
                          "max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.03] dark:brightness-90",
                        ),
                    ),
                ),
              h.div
                .class(
                  "flex flex-1 flex-col gap-2 px-3 pt-2 pb-3 sm:px-4 sm:pb-4",
                )
                .children(
                  // Beside the favourite button when the card has room,
                  // otherwise above the title so neither squeezes the other
                  h.child(FulfillmentBadge, {
                    key: "fulfillment",
                    props: {
                      id: product.id,
                      showAvailable: false,
                      class:
                        "absolute top-2 right-2 z-10 empty:hidden @max-[11rem]/card:static",
                    },
                  }),
                  h.div
                    .class(
                      "line-clamp-3 sm:line-clamp-2 h-[3lh] sm:h-[2lh] text-sm sm:text-[15px] leading-snug font-medium text-foreground group-hover:text-primary",
                    )
                    .children(product.title),
                  h.div
                    .class(
                      "mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1",
                    )
                    .children(
                      h.span
                        .class(
                          "text-lg font-bold tabular-nums text-foreground sm:text-xl",
                        )
                        .children(formatPrice(product.price)),
                      h.span
                        .class(
                          "flex items-center gap-1 text-xs text-muted-foreground tabular-nums",
                        )
                        .children(
                          starRating(h, {
                            size: "sm",
                            rating: product.rating,
                          }),
                          h.span(`(${product.numberOfReviews})`),
                        ),
                    ),
                ),
            ),
        ),
      h.div.class("absolute top-1 left-1 z-10").children(
        h.child(FavoriteButton, {
          key: "favorite",
          props: { product, variant: "icon" },
        }),
      ),
    )
  },
})
