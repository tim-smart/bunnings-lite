import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { ProductBaseInfo, ProductPriceInfo } from "api/src/domain/Bunnings"
import { StarRating } from "@/components/ui/star-rating"
import { DateTime, Option } from "effect"
import { Skeleton } from "@/components/ui/skeleton"
import { Result, Rx, useRx, useRxSet, useRxValue } from "@effect-rx/rx-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { ProductReview, ReviewStats } from "api/src/domain/Bazaar"
import Markdown from "react-markdown"
import { productFulfillmentRx, productReviewsRx } from "./rx"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/Favorites/Button"
import rehypeRaw from "rehype-raw"
import { useScrollBottom } from "@/lib/useScrollBottom"

const imageIndexRx = Rx.make(0)

export function ProductListing({
  product,
  fullInfo,
  reviews,
  reviewStats,
}: {
  readonly product: ProductBaseInfo
  readonly fullInfo: Option.Option<ProductPriceInfo>
  readonly reviewStats: Option.Option<ReviewStats>
  readonly reviews: ReadonlyArray<ProductReview>
}) {
  const pullReviews = useRxSet(productReviewsRx(product.id))

  useScrollBottom(() => {
    pullReviews()
  })

  return (
    <div className="pb-8 pt-1">
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
        {/* Product Images */}
        <div className="flex flex-col gap-4">
          <SelectedImage product={product} />
          <ThumbnailImages product={product} />
        </div>

        <div className="flex flex-col gap-6">
          <h1 className="text-2xl md:text-3xl font-bold">{product.title}</h1>

          <div className="flex items-center gap-2">
            <div className="flex">
              <StarRating rating={product.rating} />
            </div>
            <span className="text-sm text-gray-500">
              ({product.numberOfReviews} reviews)
            </span>
            <FulfillmentBadge product={product} />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">${product.price}</span>
            <span className="text-sm text-gray-500">inc. GST</span>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            <FavoriteButton product={product} />
            <Button className="bg-[#0D5257] hover:bg-[#0D5257]/90" asChild>
              <a href={product.url} target="_blank" rel="noopener noreferrer">
                Open in Bunnings
                <ArrowRight />
              </a>
            </Button>
          </div>

          <div className="flex flex-col gap-4 text-sm">
            {fullInfo.pipe(
              Option.map((info) => (
                <div className="prose">
                  <Markdown rehypePlugins={[rehypeRaw]}>
                    {info.info.feature.description}
                  </Markdown>
                </div>
              )),
              Option.getOrElse(() => <SkeletonDescription />),
            )}
          </div>
        </div>
      </div>

      {/* Product Tabs */}
      <div className="mt-12">
        <Tabs defaultValue="reviews">
          <TabsList className="w-full grid grid-cols-3 bg-gray-100">
            <TabsTrigger
              value="reviews"
              className="data-[state=active]:bg-[#0D5257] data-[state=active]:text-white"
            >
              Reviews
            </TabsTrigger>
            {Option.isSome(fullInfo) && (
              <TabsTrigger
                value="details"
                className="data-[state=active]:bg-[#0D5257] data-[state=active]:text-white"
              >
                Details
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="reviews" className="p-6 border rounded-b">
            <h3 className="text-lg font-bold mb-4">Customer Reviews</h3>

            {Option.match(reviewStats, {
              onNone: () => <SkeletonRatings />,
              onSome: (reviews) => <ReviewsOverview reviews={reviews} />,
            })}

            {reviews.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </TabsContent>

          {fullInfo.pipe(
            Option.map((info) => (
              <TabsContent value="details" className="p-6 border rounded-b">
                <h3 className="text-lg font-bold mb-4">Product Details</h3>
                <ul className="list-disc pl-5 mt-4 space-y-2">
                  {info.info.feature.pointers.map((pointer, i) => (
                    <li key={i}>{pointer}</li>
                  ))}
                </ul>
              </TabsContent>
            )),
            Option.getOrElse(() => null),
          )}
        </Tabs>
      </div>
    </div>
  )
}

function ReviewsOverview({ reviews }: { readonly reviews: ReviewStats }) {
  const stats = reviews.ReviewStatistics
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
                  className="bg-[#db2a1c] h-2 rounded-full"
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

function ReviewCard({ review }: { readonly review: ProductReview }) {
  return (
    <Card className="mb-4">
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

function SkeletonDescription() {
  return (
    <div className="flex flex-col space-y-2">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
    </div>
  )
}

function SelectedImage({ product }: { readonly product: ProductBaseInfo }) {
  const index = useRxValue(imageIndexRx)
  const image = product.images[index]
  return (
    <div className="border rounded-lg bg-white flex items-center justify-center aspect-square overflow-hidden">
      <img src={image.url} alt={product.title} />
    </div>
  )
}

function ThumbnailImages({ product }: { readonly product: ProductBaseInfo }) {
  const [index, setIndex] = useRx(imageIndexRx)
  return (
    <div className="grid grid-cols-4 gap-2">
      {product.images.map((image, i) => (
        <button
          key={i}
          className={cn(
            "border rounded-md p-2 hover:border-[#0D5257]",
            i === index ? "border-[#0D5257]" : undefined,
          )}
          onClick={() => setIndex(i)}
        >
          <img src={image.thumbnailUrl} alt={product.title} />
        </button>
      ))}
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

function FulfillmentBadge({ product }: { readonly product: ProductBaseInfo }) {
  const maybeResult = Result.getOrElse(
    useRxValue(productFulfillmentRx(product.id)),
    Option.none,
  )

  if (Option.isNone(maybeResult)) {
    return null
  }

  const fullfillment = maybeResult.value
  if (!fullfillment.isAvailable) {
    return <Badge className="bg-orange-500 text-white">Out of stock</Badge>
  } else if (Option.isSome(fullfillment.location)) {
    const { aisle, bay } = fullfillment.location.value
    return (
      <Badge className="bg-green-500 text-white">
        Aisle {aisle}/{bay}
      </Badge>
    )
  }

  return <Badge className="bg-green-500 text-white">Available</Badge>
}
