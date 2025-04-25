import { ProductListing } from "@/Product/Listing"
import {
  productFullInfoRx,
  productReviewsRx,
  productReviewStatsRx,
  productRx,
} from "@/Product/rx"
import { BaseInfoKey } from "@/RpcClient"
import { resultsRx } from "@/Search/rx"
import { Result, useRxMount, useRxValue } from "@effect-rx/rx-react"
import { createFileRoute } from "@tanstack/react-router"
import { Option } from "effect"

export const Route = createFileRoute("/product/$id")({
  component: ProductScreen,
})

export function ProductScreen() {
  // Keep the search results alive
  useRxMount(resultsRx)

  const { id } = Route.useParams()
  const product = useRxValue(productRx(new BaseInfoKey({ id })))
  const fullInfo = Result.value(useRxValue(productFullInfoRx(id)))
  const reviewStats = Option.flatten(
    Result.value(useRxValue(productReviewStatsRx(id))),
  )
  const reviews = Result.getOrElse(
    useRxValue(
      productReviewsRx(id),
      Result.map((_) => _.items),
    ),
    () => [],
  )
  if (product._tag !== "Success") {
    return null
  }
  return (
    <ProductListing
      product={fullInfo.pipe(
        Option.map((full) => full.asBaseInfo),
        Option.getOrElse(() => product.value),
      )}
      fullInfo={fullInfo}
      reviewStats={reviewStats}
      reviews={reviews}
    />
  )
}
