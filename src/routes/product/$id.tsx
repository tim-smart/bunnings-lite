import { ProductListing } from "@/Product/Listing"
import { productFullInfoRx, productRx } from "@/Product/rx"
import { BaseInfoKey } from "@/RpcClient"
import { Result, useRxValue } from "@effect-rx/rx-react"
import { createFileRoute } from "@tanstack/react-router"
import * as Option from "effect/Option"

export const Route = createFileRoute("/product/$id")({
  component: ProductScreen,
})

export function ProductScreen() {
  const { id } = Route.useParams()
  const product = useRxValue(productRx(new BaseInfoKey({ id })))
  const fullInfo = Result.value(useRxValue(productFullInfoRx(id)))
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
    />
  )
}
