import { DateTime, Effect, Layer, Option, Schema } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, Head, Router, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import type {
  ProductReview,
  ReviewStats,
} from "../../../server/src/domain/Bazaar.ts"
import type {
  ProductBaseInfo,
  ProductPriceInfo,
} from "../../../server/src/domain/Bunnings.ts"
import { Share } from "../../browser/services/Share.ts"
import { bottomReached, hasMore } from "../../browser/subscriptions.ts"
import { buttonClass, cardClass } from "../../design/classes.ts"
import { Icon } from "../../design/icons.ts"
import { RichText } from "../../design/richText.ts"
import { Skeleton } from "../../design/skeleton.ts"
import { StarRating } from "../../design/starRating.ts"
import { FavoriteButton } from "../../favorites/components/FavoriteButton.ts"
import { formatPrice } from "../../lib/utils.ts"
import { FulfillmentBadge } from "../../product/components/FulfillmentBadge.ts"
import { parseRichText } from "../../product/domain/RichText.ts"
import { GetKnownProduct } from "../../product/queries/GetKnownProduct.ts"
import { GetProduct } from "../../product/queries/GetProduct.ts"
import { GetReviewStats } from "../../product/queries/GetReviewStats.ts"
import { ListReviews } from "../../product/queries/ListReviews.ts"
import { KnownProducts } from "../../product/services/KnownProducts.ts"
import { ReviewFeed } from "../../product/services/ReviewFeed.ts"
import { Session } from "../../rpc/services/Session.ts"

export const ProductPageMessage = UiSchema.TaggedEnum({
  ClickedImage: { index: Schema.Number },
  ClickedBack: {},
  ClickedShare: { title: Schema.String },
  ReachedBottom: {},
})

/** Offers the product's page to the device's share sheet. */
export class ShareProduct extends Command.Service<ShareProduct>()(
  "product/ShareProduct",
  { args: { title: Schema.String } },
  Effect.gen(function* () {
    const share = yield* Share
    return ({ title }) => Effect.as(share.sharePage(title), Component.noop)
  }),
) {}

/**
 * What is known of the product so far: all of it once it has loaded, until
 * then what a search or the favourites said about it.
 */
const productOf = (
  fullInfo: Option.Option<ProductPriceInfo>,
  known: Option.Option<Option.Option<ProductBaseInfo>>,
): Option.Option<ProductBaseInfo> =>
  Option.orElse(
    Option.map(fullInfo, (info) => info.asBaseInfo),
    () => Option.flatten(known),
  )

const ProductPageDef = Html.component({
  name: "ProductPage",
  props: Schema.Struct({ id: Schema.String }),
  model: Schema.Struct({
    /** Which photo is showing. */
    image: Schema.Number,
  }),
  message: ProductPageMessage,
  queries: {
    product: { query: GetProduct, args: ({ props }) => ({ id: props.id }) },
    known: {
      query: GetKnownProduct,
      args: ({ props }) => ({ id: props.id }),
    },
    stats: {
      query: GetReviewStats,
      args: ({ props }) => ({ id: props.id }),
    },
    reviews: {
      query: ListReviews,
      args: ({ props }) => ({ id: props.id }),
    },
  },
})

const description = ProductPageDef.fragment(
  (h, fullInfo: Option.Option<ProductPriceInfo>) =>
    Option.match(fullInfo, {
      onNone: () =>
        h.div
          .class("flex flex-col space-y-2")
          .children(
            Skeleton(h, "h-4 w-full"),
            Skeleton(h, "h-4 w-full"),
            Skeleton(h, "h-4 w-full"),
          ),
      onSome: (info) => {
        const pointers = info.info.feature.pointers ?? []
        return h.div
          .class(
            "prose prose-sm sm:prose-base max-w-none prose-p:text-foreground prose-li:text-foreground prose-li:marker:text-accent prose-a:text-primary dark:prose-invert",
          )
          .children(
            pointers.length > 0 &&
              h.ul(
                pointers.map((pointer, i) =>
                  h.li.key(String(i)).children(pointer),
                ),
              ),
            RichText(
              h,
              parseRichText(info.info.feature.description, { html: true }),
            ),
          )
      },
    }),
)

const specificationRow =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 rounded-lg px-2 even:bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:px-3"

const specificationsSection = ProductPageDef.fragment(
  (h, fullInfo: Option.Option<ProductPriceInfo>) => {
    const specifications = Option.map(
      fullInfo,
      (info) => info.info.specifications,
    )
    return Option.isSome(specifications) && specifications.value.length === 0
      ? undefined
      : h.section
          .attr("aria-labelledby", "specifications-heading")
          .class("rounded-xl bg-card p-4 sm:p-6")
          .children(
            h.h2
              .id("specifications-heading")
              .class("text-lg font-bold tracking-tight mb-3")
              .children("Specifications"),
            Option.match(specifications, {
              onNone: () =>
                h.div
                  .class("-mx-2 flex flex-col sm:-mx-3")
                  .children(
                    [0, 1, 2, 3, 4, 5].map((i) =>
                      h.div
                        .class(specificationRow, "py-3")
                        .key(String(i))
                        .children(
                          Skeleton(h, "h-3.5 w-3/4"),
                          Skeleton(h, "h-3.5 w-1/2"),
                        ),
                    ),
                  ),
              onSome: (specifications) =>
                h.dl
                  .class("-mx-2 flex flex-col sm:-mx-3")
                  .children(
                    specifications.map((spec, i) =>
                      h.div
                        .class(
                          specificationRow,
                          "py-2.5 text-sm leading-snug sm:text-[15px]",
                        )
                        .key(String(i))
                        .children(
                          h.dt
                            .class("text-muted-foreground")
                            .children(spec.name),
                          h.dd
                            .class("font-medium break-words tabular-nums")
                            .children(spec.value),
                        ),
                    ),
                  ),
            }),
          )
  },
)

const images = ProductPageDef.fragment(
  (h, product: ProductBaseInfo, chosen: number) => {
    const image = product.images[chosen] ?? product.images[0]
    return h.div
      .class(
        "flex flex-col gap-2 sm:gap-3 md:col-start-1 md:row-start-1 md:row-span-2 md:sticky md:top-6 md:self-start",
      )
      .children(
        h.div
          .class(
            "rounded-xl bg-image-well text-image-well-foreground flex items-center justify-center aspect-square overflow-hidden p-6 sm:p-10",
          )
          .children(
            h.img
              .attr("src", image.url)
              .attr("alt", product.title)
              .class(
                "max-h-full max-w-full object-contain animate-in fade-in duration-300 dark:brightness-90",
              )
              .key(image.url),
          ),
        h.div.class("grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-5").children(
          product.images.map((image, i) =>
            h.button
              .attr("type", "button")
              .attr("aria-label", `Show image ${i + 1}`)
              .attr("aria-current", i === chosen ? "true" : undefined)
              .class(
                "aspect-square cursor-pointer rounded-lg bg-image-well p-2 text-image-well-foreground ring-inset transition-shadow hover:ring-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                i === chosen
                  ? "ring-2 ring-brand hover:ring-brand"
                  : "hover:ring-brand/30",
              )
              .onClick(ProductPageMessage.ClickedImage({ index: i }))
              .key(String(i))
              .children(
                h.img
                  .attr("src", image.thumbnailUrl)
                  .attr("alt", "")
                  .class("size-full object-contain dark:brightness-90"),
              ),
          ),
        ),
      )
  },
)

const reviewsOverview = ProductPageDef.fragment(
  (h, stats: Option.Option<ReviewStats["ReviewStatistics"]>) =>
    Option.match(stats, {
      onNone: () =>
        h.div
          .class(
            "flex items-center gap-4 mb-4 sm:mb-6 rounded-xl bg-card p-4 sm:p-6 md:max-w-xl",
          )
          .children(
            h.div
              .class("flex w-full space-y-3")
              .children(
                Skeleton(h, "h-32 w-32 rounded-xl"),
                h.div.class("w-4"),
                h.div
                  .class("space-y-2 flex-1")
                  .children(
                    [0, 1, 2, 3, 4].map((i) =>
                      Skeleton(h, "h-4 w-full").key(String(i)),
                    ),
                  ),
              ),
          ),
      onSome: (stats) =>
        h.div
          .class(
            "flex items-center gap-6 mb-4 sm:mb-6 rounded-xl bg-card p-4 sm:p-6 md:max-w-xl",
          )
          .children(
            h.div
              .class("flex flex-col items-center gap-1")
              .children(
                h.span
                  .class("text-5xl font-bold tracking-tight tabular-nums")
                  .children(stats.AverageOverallRating.toFixed(1)),
                h.div
                  .class("flex")
                  .children(
                    StarRating(h, { rating: stats.AverageOverallRating }),
                  ),
                h.span
                  .class("text-sm text-muted-foreground tabular-nums")
                  .children(`${stats.TotalReviewCount} reviews`),
              ),
            h.div.class("flex flex-1 flex-col gap-1.5").children(
              [5, 4, 3, 2, 1].map((stars) => {
                const rating = stats.RatingDistribution.find(
                  (rating) => rating.RatingValue === stars,
                )
                const percentage =
                  rating === undefined || stats.TotalReviewCount === 0
                    ? 0
                    : Math.round(100 * (rating.Count / stats.TotalReviewCount))
                return h.div
                  .class("flex items-center gap-3 text-sm tabular-nums")
                  .key(String(stars))
                  .children(
                    h.span
                      .class("w-2 text-muted-foreground")
                      .children(String(stars)),
                    h.div
                      .class("w-full bg-muted rounded-full h-2 overflow-hidden")
                      .children(
                        h.div
                          .class("bg-secondary h-2 rounded-full")
                          .attr("style", `width: ${percentage}%`),
                      ),
                  )
              }),
            ),
          ),
    }),
)

const reviewCard = ProductPageDef.fragment((h, review: ProductReview) =>
  h.div
    .class(cardClass("gap-0 py-5"))
    .key(review.Id)
    .children(
      h.div.class("px-5").children(
        h.div.class("flex justify-between items-start gap-4").children(
          h.div
            .class("flex flex-col gap-1.5")
            .children(
              StarRating(h, { size: "sm", rating: review.Rating }),
              h.h3
                .class("font-semibold leading-snug")
                .children(review.Title ?? ""),
            ),
          h.span
            .class("shrink-0 text-sm text-muted-foreground tabular-nums")
            .children(
              DateTime.formatLocal(review.SubmissionTime, {
                dateStyle: "short",
              }),
            ),
        ),
        h.div
          .class(
            "mt-2 prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground/85",
          )
          .children(
            RichText(h, parseRichText(review.ReviewText, { html: false })),
          ),
      ),
    ),
)

const productPageView = ProductPageDef.view((h, model) => {
  const fullInfo: Option.Option<ProductPriceInfo> = AsyncResult.value(
    h.queries.product,
  )
  const base = productOf(fullInfo, AsyncResult.value(h.queries.known))

  if (Option.isNone(base)) {
    return AsyncResult.isFailure(h.queries.product)
      ? h.div
          .class(
            "flex flex-col items-center gap-4 pt-20 text-lg text-muted-foreground",
          )
          .children(
            h.p.attr("role", "status").children("Couldn't load this product."),
            h.a
              .attr("href", "/")
              .class(buttonClass({ variant: "outline" }))
              .children("Back to search"),
          )
      : h.div
          .class(
            "flex h-full items-center justify-center text-lg text-muted-foreground pt-20 animate-pulse",
          )
          .children("Loading product...")
  }
  const product = base.value

  const stats = Option.map(
    Option.flatten(AsyncResult.value(h.queries.stats)),
    (stats) => stats.ReviewStatistics,
  )
  const rating = Option.match(stats, {
    onNone: () => product.rating,
    onSome: (stats) => stats.AverageOverallRating,
  })
  const reviewCount = Option.match(stats, {
    onNone: () => product.numberOfReviews,
    onSome: (stats) => stats.TotalReviewCount,
  })

  const reviews = Option.match(
    Option.orElse(
      AsyncResult.value(h.queries.reviews),
      () => h.previous.reviews,
    ),
    { onNone: () => [], onSome: (list) => list.items },
  )

  return h.div(
    h.div.class("py-3 sm:py-4").children(
      h.button
        .attr("type", "button")
        .class(buttonClass({ variant: "link", class: "-ml-3 cursor-pointer" }))
        .onClick(ProductPageMessage.ClickedBack())
        .children(Icon(h, "arrowLeft"), "Back"),
    ),
    h.div
      .class(
        "grid grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:gap-x-12",
      )
      .children(
        h.div
          .class("flex flex-col gap-5 md:col-start-2 md:row-start-1 md:pt-2")
          .children(
            h.div.class("flex flex-col gap-3").children(
              h.h1
                .class(
                  "text-2xl md:text-3xl font-bold leading-tight tracking-tight text-balance",
                )
                .children(product.title),
              h.div.class("flex flex-wrap gap-3 items-center").children(
                FulfillmentBadge(h, {
                  key: "fulfillment",
                  props: {
                    id: product.id,
                    showAvailable: false,
                    class: "empty:hidden",
                  },
                }),
                h.span
                  .class("text-sm text-muted-foreground tabular-nums")
                  .children(`I/N: ${product.id}`),
              ),
            ),
            h.div
              .class("flex flex-wrap items-center gap-x-6 gap-y-2")
              .children(
                h.div
                  .class("flex items-baseline gap-2")
                  .children(
                    h.span
                      .class(
                        "text-4xl font-bold tracking-tight tabular-nums text-primary",
                      )
                      .children(formatPrice(product.price)),
                    h.span
                      .class("text-sm text-muted-foreground")
                      .children("inc. GST"),
                  ),
                h.div
                  .class("flex items-center gap-2")
                  .children(
                    StarRating(h, { rating }),
                    h.span
                      .class("text-sm text-muted-foreground tabular-nums")
                      .children(`(${reviewCount} reviews)`),
                  ),
              ),
            h.div
              .class(
                "grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center",
              )
              .children(
                h.a
                  .attr("href", product.url)
                  .attr("target", "_blank")
                  .attr("rel", "noopener noreferrer")
                  .class(
                    buttonClass({
                      variant: "secondary",
                      size: "lg",
                      class: "col-span-2",
                    }),
                  )
                  .children("Open in Bunnings", Icon(h, "arrowRight")),
                FavoriteButton(h, {
                  key: "favorite",
                  props: { product, variant: "button" },
                }),
                h.button
                  .attr("type", "button")
                  .class(buttonClass({ variant: "outline", size: "lg" }))
                  .onClick(
                    ProductPageMessage.ClickedShare({
                      title: product.title,
                    }),
                  )
                  .children(Icon(h, "share"), "Share"),
              ),
          ),
        images(h, product, model.image),
        h.div
          .class("flex flex-col gap-4 md:col-start-2 md:row-start-2 md:gap-5")
          .children(
            h.div
              .class("rounded-xl bg-card p-4 sm:p-6")
              .children(description(h, fullInfo)),
            specificationsSection(h, fullInfo),
          ),
      ),
    h.div.class("h-10 md:h-16"),
    h.section
      .attr("aria-labelledby", "reviews-heading")
      .children(
        h.h2
          .id("reviews-heading")
          .class("text-xl md:text-2xl font-bold tracking-tight mb-4")
          .children("Customer Reviews"),
        reviewsOverview(h, stats),
        h.div
          .class(
            "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4",
          )
          .children(reviews.map((review) => reviewCard(h, review))),
      ),
  )
})

/**
 * A product: its photos, price, stock at the chosen store, description,
 * specifications and reviews. It opens with what a search or the favourites
 * already said about the product while the rest loads.
 */
export const ProductPageNoDeps = ProductPageDef.make({
  init: () => ({ image: 0 }),
  update: ($, message) =>
    ProductPageMessage.match(message, {
      ClickedImage: ({ index }) => $.evolve({ image: index }),
      ClickedBack: () => $.run(Router.Back.make().pipe(Command.asNoop)),
      ClickedShare: ({ title }) => $.run(ShareProduct.make({ title })),
      ReachedBottom: () =>
        hasMore($.queries.reviews) ? $.loadMore("reviews") : $.model,
    }),
  subscriptions: () => [bottomReached(ProductPageMessage.ReachedBottom())],
  head: ({ queries }) => [
    Head.title(
      Option.match(
        productOf(
          AsyncResult.value(queries.product),
          AsyncResult.value(queries.known),
        ),
        { onNone: () => "Product", onSome: (product) => product.title },
      ),
    ),
  ],
  view: productPageView,
})

export const ProductPage = ProductPageNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(
      GetProduct.layer,
      GetKnownProduct.layer,
      GetReviewStats.layer,
      ListReviews.layer.pipe(Layer.provide(ReviewFeed.layer)),
      ShareProduct.layer,
    ).pipe(Layer.provide([Session.layer, KnownProducts.layer])),
  ),
)
