import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { ProductBaseInfo, ProductPriceInfo } from "api/src/domain/Bunnings"
import { StarRating } from "@/components/ui/star-rating"
import { Option } from "effect"
import { Skeleton } from "@/components/ui/skeleton"
import { Rx, useRx, useRxValue } from "@effect-rx/rx-react"
import { cn } from "@/lib/utils"

const imageIndexRx = Rx.make(0)

export function ProductListing({
  product,
  fullInfo,
}: {
  readonly product: ProductBaseInfo
  readonly fullInfo: Option.Option<ProductPriceInfo>
}) {
  return (
    <div className="py-8">
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
            <span className="text-sm ml-4">Item #{product.id}</span>
          </div>

          <div className="flex items-baseline">
            <span className="text-3xl font-bold">${product.price}</span>
            <span className="ml-2 text-sm text-gray-500">inc. GST</span>
          </div>

          <div className="flex flex-col gap-4 my-2 text-sm">
            {fullInfo.pipe(
              Option.map((info) => (
                <div
                  className="prose"
                  {...{
                    dangerouslySetInnerHTML: {
                      __html: info.info.feature.description,
                    },
                  }}
                ></div>
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
            <TabsTrigger
              value="details"
              className="data-[state=active]:bg-[#0D5257] data-[state=active]:text-white"
            >
              Details
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reviews" className="p-6 border rounded-b">
            <h3 className="text-lg font-bold mb-4">Customer Reviews</h3>
            <div className="flex items-center gap-4 mb-6 max-w-lg">
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold">
                  {product.rating.toFixed(1)}
                </span>
                <div className="flex">
                  <StarRating rating={product.rating} />
                </div>
                <span className="text-sm text-gray-500">
                  {product.numberOfReviews} reviews
                </span>
              </div>
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map((i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-2">{i}</span>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full"
                        style={{
                          width:
                            i === 3
                              ? "60%"
                              : i === 4
                                ? "20%"
                                : i === 5
                                  ? "10%"
                                  : "5%",
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ReviewCard />
          </TabsContent>
          <TabsContent value="details" className="p-6 border rounded-b">
            <h3 className="text-lg font-bold mb-4">Product Details</h3>
            <p>
              The Sutton Tools 4 Piece Forstner Bit Set is designed for drilling
              flat-bottomed holes in wood. Perfect for furniture making, cabinet
              construction, and various woodworking projects.
            </p>
            <ul className="list-disc pl-5 mt-4 space-y-2">
              <li>Premium quality high-speed steel construction</li>
              <li>Precision ground cutting edges for clean, accurate holes</li>
              <li>Sizes included: 15mm, 20mm, 25mm, and 30mm</li>
              <li>Comes in a durable storage case</li>
              <li>Compatible with most drill presses and hand drills</li>
            </ul>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ReviewCard() {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-bold">Great value for money</h4>
            <div className="flex my-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg
                  key={i}
                  className={`w-4 h-4 ${i <= 4 ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
          </div>
          <span className="text-sm text-gray-500">07/03/2025</span>
        </div>
        <p className="text-sm mt-2">
          Used these for a cabinet project and they worked extremely well. Clean
          cuts and good quality for the price.
        </p>
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
    <div className="border rounded-lg bg-white p-8 flex items-center justify-center">
      <img
        src={image.url}
        alt={product.title}
        width={400}
        height={400}
        className="object-contain"
      />
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
          <img
            src={image.thumbnailUrl}
            alt={product.title}
            width={80}
            height={80}
            className="object-contain"
          />
        </button>
      ))}
    </div>
  )
}
