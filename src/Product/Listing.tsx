import { Card, CardContent } from "@/components/ui/card"
import {
  ProductBaseInfo,
  ProductPriceInfo,
} from "../../server/src/domain/Bunnings.ts"
import { StarRating } from "@/components/ui/star-rating"
import { Skeleton } from "@/components/ui/skeleton"
import { useAtom, useAtomValue } from "@effect/atom-react"
import { cn, formatPrice } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Share } from "lucide-react"
import { ProductReview } from "../../server/src/domain/Bazaar.ts"
import Markdown from "react-markdown"
import {
  productRatingAtom,
  productReviewCountAtom,
  productReviewsAtom,
  productReviewStatsAtom,
} from "./atoms"
import { FavoriteButton } from "@/Favorites/Button"
import rehypeRaw from "rehype-raw"
import { useScrollBottom } from "@/lib/useScrollBottom"
import { FulfillmentBadge } from "./FulfillmentBadge"
import * as DateTime from "effect/DateTime"
import * as Option from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as AsyncResult from "effect/reactivity/AsyncResult"

export function ProductListing({
  product,
  fullInfo,
}: {
  readonly product: ProductBaseInfo
  readonly fullInfo: Option.Option<ProductPriceInfo>
}) {
  const pointers = fullInfo.pipe(
    Option.flatMapNullishOr((info) => info.info.feature.pointers),
  )

  const description = (
    <>
      {fullInfo.pipe(
        Option.map((info) => (
          <div className="prose prose-sm sm:prose-base max-w-none prose-p:text-foreground prose-li:text-foreground prose-li:marker:text-secondary prose-a:text-primary">
            {Option.isSome(pointers) && (
              <ul>
                {pointers.value.map((pointer, i) => (
                  <li key={i}>{pointer}</li>
                ))}
              </ul>
            )}
            <Markdown rehypePlugins={[rehypeRaw]}>
              {info.info.feature.description}
            </Markdown>
          </div>
        )),
        Option.getOrElse(() => <SkeletonDescription />),
      )}
    </>
  )

  return (
    <div>
      <div className="py-3 sm:py-4">
        <Button
          variant="link"
          className="-ml-3 cursor-pointer"
          onClick={() => history.back()}
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-[auto_1fr] md:gap-x-8 md:gap-y-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:gap-x-12">
        <div className="flex flex-col gap-5 md:col-start-2 md:row-start-1 md:pt-2">
          <div className="flex flex-col gap-3">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight tracking-tight text-balance">
              {product.title}
            </h1>

            <div className="flex flex-wrap gap-3 items-center">
              <FulfillmentBadge product={product} />
              <span className="text-sm text-muted-foreground tabular-nums">
                I/N: {product.id}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tracking-tight tabular-nums text-primary">
                {formatPrice(product.price)}
              </span>
              <span className="text-sm text-muted-foreground">inc. GST</span>
            </div>
            <ProductRating product={product} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Button
              asChild
              variant="secondary"
              size="lg"
              className="col-span-2"
            >
              <a href={product.url} target="_blank" rel="noopener noreferrer">
                Open in Bunnings
                <ArrowRight />
              </a>
            </Button>
            <FavoriteButton product={product} />
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                if (!navigator.share) return
                navigator.share({
                  title: product.title,
                  url: window.location.href,
                })
              }}
            >
              <Share />
              Share
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:gap-3 md:col-start-1 md:row-start-1 md:row-span-2 md:sticky md:top-6 md:self-start">
          <SelectedImage product={product} />
          <ThumbnailImages product={product} />
        </div>

        <div className="flex flex-col gap-4 md:col-start-2 md:row-start-2 md:gap-5">
          <div className="rounded-xl bg-white p-4 sm:p-6">{description}</div>
          <Specifications fullInfo={fullInfo} />
        </div>
      </div>

      <div className="h-10 md:h-16" />

      <Reviews product={product} />
    </div>
  )
}

function ProductRating({ product }: { readonly product: ProductBaseInfo }) {
  const numberOfReviews = useAtomValue(productReviewCountAtom(product))
  const rating = useAtomValue(productRatingAtom(product))
  return (
    <div className="flex items-center gap-2">
      <StarRating rating={rating} />
      <span className="text-sm text-muted-foreground tabular-nums">
        ({numberOfReviews} reviews)
      </span>
    </div>
  )
}

function SkeletonDescription() {
  return (
    <div className="flex flex-col space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

function Specifications({
  fullInfo,
}: {
  readonly fullInfo: Option.Option<ProductPriceInfo>
}) {
  const specifications = fullInfo.pipe(
    Option.map((info) => info.info.specifications),
  )
  if (Option.isSome(specifications) && specifications.value.length === 0) {
    return null
  }
  return (
    <section
      aria-labelledby="specifications-heading"
      className="rounded-xl bg-white p-4 sm:p-6"
    >
      <h2
        id="specifications-heading"
        className="text-lg font-bold tracking-tight mb-3"
      >
        Specifications
      </h2>
      {Option.isSome(specifications) ? (
        <dl className="-mx-2 flex flex-col sm:-mx-3">
          {specifications.value.map((spec, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 rounded-lg px-2 py-2.5 text-sm leading-snug even:bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:px-3 sm:text-[15px]"
            >
              <dt className="text-muted-foreground">{spec.name}</dt>
              <dd className="font-medium break-words tabular-nums">
                {spec.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <SkeletonSpecifications />
      )}
    </section>
  )
}

function SkeletonSpecifications() {
  return (
    <div className="-mx-2 flex flex-col sm:-mx-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 rounded-lg px-2 py-3 even:bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] sm:px-3"
        >
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3.5 w-1/2" />
        </div>
      ))}
    </div>
  )
}

const imageIndexAtom = Atom.make(0)

function SelectedImage({ product }: { readonly product: ProductBaseInfo }) {
  const index = useAtomValue(imageIndexAtom)
  const image = product.images[index]
  return (
    <div className="rounded-xl bg-white flex items-center justify-center aspect-square overflow-hidden p-6 sm:p-10">
      <img
        key={image.url}
        src={image.url}
        alt={product.title}
        className="max-h-full max-w-full object-contain animate-in fade-in duration-300"
      />
    </div>
  )
}

function ThumbnailImages({ product }: { readonly product: ProductBaseInfo }) {
  const [index, setIndex] = useAtom(imageIndexAtom)
  return (
    <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-5">
      {product.images.map((image, i) => (
        <button
          key={i}
          aria-label={`Show image ${i + 1}`}
          aria-current={i === index ? "true" : undefined}
          className={cn(
            "aspect-square cursor-pointer rounded-lg bg-white p-2 ring-inset transition-shadow hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            i === index && "ring-2 ring-primary hover:ring-primary",
          )}
          onClick={() => setIndex(i)}
        >
          <img
            src={image.thumbnailUrl}
            alt=""
            className="size-full object-contain"
          />
        </button>
      ))}
    </div>
  )
}

function Reviews({ product }: { readonly product: ProductBaseInfo }) {
  return (
    <section aria-labelledby="reviews-heading">
      <h2
        id="reviews-heading"
        className="text-xl md:text-2xl font-bold tracking-tight mb-4"
      >
        Customer Reviews
      </h2>
      <ReviewsOverview product={product} />
      <ReviewsGrid product={product} />
    </section>
  )
}

function ReviewsOverview({ product }: { readonly product: ProductBaseInfo }) {
  const reviewStats = useAtomValue(productReviewStatsAtom(product.id))
  if (Option.isNone(reviewStats)) {
    return <SkeletonRatings />
  }
  const stats = reviewStats.value.ReviewStatistics
  return (
    <div className="flex items-center gap-6 mb-4 sm:mb-6 rounded-xl bg-white p-4 sm:p-6 md:max-w-xl">
      <div className="flex flex-col items-center gap-1">
        <span className="text-5xl font-bold tracking-tight tabular-nums">
          {stats.AverageOverallRating.toFixed(1)}
        </span>
        <div className="flex">
          <StarRating rating={stats.AverageOverallRating} />
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">
          {stats.TotalReviewCount} reviews
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {[5, 4, 3, 2, 1].map((i) => {
          const rating = stats.RatingDistribution.find(
            (r) => r.RatingValue === i,
          )
          const percentage = rating
            ? Math.round(100 * (rating.Count / stats.TotalReviewCount))
            : 0
          return (
            <div
              key={i}
              className="flex items-center gap-3 text-sm tabular-nums"
            >
              <span className="w-2 text-muted-foreground">{i}</span>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-secondary h-2 rounded-full"
                  style={{
                    width: `${percentage}%`,
                  }}
                ></div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function SkeletonRatings() {
  return (
    <div className="flex items-center gap-4 mb-4 sm:mb-6 rounded-xl bg-white p-4 sm:p-6 md:max-w-xl">
      <div className="flex w-full space-y-3">
        <Skeleton className="h-32 w-32 rounded-xl" />
        <div className="w-4" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  )
}

function ReviewsGrid({ product }: { readonly product: ProductBaseInfo }) {
  const [result, pullReviews] = useAtom(productReviewsAtom(product.id))

  const reviews = AsyncResult.map(result, (_) => _.items).pipe(
    AsyncResult.getOrElse(() => []),
  )

  useScrollBottom(() => {
    pullReviews()
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
      {reviews.map((review, i) => (
        <ReviewCard key={i} review={review} />
      ))}
    </div>
  )
}

function ReviewCard({ review }: { readonly review: ProductReview }) {
  return (
    <Card className="gap-0 py-5">
      <CardContent className="px-5">
        <div className="flex justify-between items-start gap-4">
          <div className="flex flex-col gap-1.5">
            <StarRating size="sm" rating={review.Rating} />
            <h3 className="font-semibold leading-snug">{review.Title}</h3>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
            {DateTime.formatLocal(review.SubmissionTime, {
              dateStyle: "short",
            })}
          </span>
        </div>
        <div className="mt-2 prose prose-sm max-w-none prose-p:text-foreground/85">
          <Markdown>{review.ReviewText}</Markdown>
        </div>
      </CardContent>
    </Card>
  )
}
