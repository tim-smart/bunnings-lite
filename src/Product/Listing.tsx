import { Card, CardContent } from "@/components/ui/card"
import { ProductBaseInfo, ProductPriceInfo } from "server/src/domain/Bunnings"
import { StarRating } from "@/components/ui/star-rating"
import { Skeleton } from "@/components/ui/skeleton"
import { Result, Atom, useAtom, useAtomValue } from "@effect-atom/atom-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { ProductReview } from "server/src/domain/Bazaar"
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

export function ProductListing({
  product,
  fullInfo,
}: {
  readonly product: ProductBaseInfo
  readonly fullInfo: Option.Option<ProductPriceInfo>
}) {
  const pointers = fullInfo.pipe(
    Option.flatMapNullable((info) => info.info.feature.pointers),
  )

  const description = (
    <>
      {fullInfo.pipe(
        Option.map((info) => (
          <div className="prose">
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
      <div className="py-2">
        <Button
          variant="link"
          className="cursor-pointer"
          onClick={() => history.back()}
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>

          <div className="flex gap-4 items-center">
            <FulfillmentBadge product={product} />
            <span className="text-sm text-gray-500">I/N: {product.id}</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">${product.price}</span>
              <span className="text-sm text-gray-500">inc. GST</span>
            </div>
            <ProductRating product={product} />
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <FavoriteButton product={product} />
            <Button asChild>
              <a href={product.url} target="_blank" rel="noopener noreferrer">
                Open in Bunnings
                <ArrowRight />
              </a>
            </Button>
          </div>

          <div className="flex-col gap-4 text-sm hidden md:block">
            {description}
          </div>
        </div>

        <div className="flex flex-col gap-4 md:-order-1">
          <SelectedImage product={product} />
          <ThumbnailImages product={product} />
        </div>

        <div className="flex flex-col gap-4 text-sm md:hidden">
          {description}
        </div>
      </div>

      <div className="h-8 md:h-12" />

      <Reviews product={product} />
    </div>
  )
}

function ProductRating({ product }: { readonly product: ProductBaseInfo }) {
  const numberOfReviews = useAtomValue(productReviewCountAtom(product))
  const rating = useAtomValue(productRatingAtom(product))
  return (
    <div className="flex gap-2">
      <StarRating rating={rating} />
      <span className="text-sm text-gray-500">({numberOfReviews} reviews)</span>
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

const imageIndexAtom = Atom.make(0)

function SelectedImage({ product }: { readonly product: ProductBaseInfo }) {
  const index = useAtomValue(imageIndexAtom)
  const image = product.images[index]
  return (
    <div className="border rounded-lg bg-white flex items-center justify-center aspect-square overflow-hidden">
      <img src={image.url} alt={product.title} />
    </div>
  )
}

function ThumbnailImages({ product }: { readonly product: ProductBaseInfo }) {
  const [index, setIndex] = useAtom(imageIndexAtom)
  return (
    <div className="grid grid-cols-4 gap-2">
      {product.images.map((image, i) => (
        <button
          key={i}
          className={cn(
            "border rounded-md p-2 hover:border-primary",
            i === index ? "border-primary" : undefined,
          )}
          onClick={() => setIndex(i)}
        >
          <img src={image.thumbnailUrl} alt={product.title} />
        </button>
      ))}
    </div>
  )
}

function Reviews({ product }: { readonly product: ProductBaseInfo }) {
  return (
    <div>
      <h3 className="text-2xl font-bold mb-4">Customer Reviews</h3>
      <ReviewsOverview product={product} />,
      <ReviewsGrid product={product} />
    </div>
  )
}

function ReviewsOverview({ product }: { readonly product: ProductBaseInfo }) {
  const reviewStats = useAtomValue(productReviewStatsAtom(product.id))
  if (Option.isNone(reviewStats)) {
    return <SkeletonRatings />
  }
  const stats = reviewStats.value.ReviewStatistics
  return (
    <div className="flex items-center gap-4 mb-6 max-w-lg">
      <div className="flex flex-col items-center">
        <span className="text-4xl font-bold">
          {stats.AverageOverallRating.toFixed(1)}
        </span>
        <div className="flex">
          <StarRating rating={stats.AverageOverallRating} />
        </div>
        <span className="text-sm text-gray-500">
          {stats.TotalReviewCount} reviews
        </span>
      </div>
      <div className="flex-1">
        {[5, 4, 3, 2, 1].map((i) => {
          const rating = stats.RatingDistribution.find(
            (r) => r.RatingValue === i,
          )
          const percentage = rating
            ? Math.round(100 * (rating.Count / stats.TotalReviewCount))
            : 0
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="w-2">{i}</span>
              <div className="w-full bg-gray-200 rounded-full h-2">
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
    <div className="flex items-center gap-4 mb-6 max-w-lg">
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

  const reviews = Result.map(result, (_) => _.items).pipe(
    Result.getOrElse(() => []),
  )

  useScrollBottom(() => {
    pullReviews()
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 grid-template-rows-[masonry]">
      {reviews.map((review, i) => (
        <ReviewCard key={i} review={review} />
      ))}
    </div>
  )
}

function ReviewCard({ review }: { readonly review: ProductReview }) {
  return (
    <Card>
      <CardContent>
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-bold">{review.Title}</h4>
            <div className="flex my-1">
              <StarRating size="sm" rating={review.Rating} />
            </div>
          </div>
          <span className="text-sm text-gray-500">
            {DateTime.formatLocal(review.SubmissionTime, {
              dateStyle: "short",
            })}
          </span>
        </div>
        <div className="mt-2 prose prose-sm">
          <Markdown>{review.ReviewText}</Markdown>
        </div>
      </CardContent>
    </Card>
  )
}
