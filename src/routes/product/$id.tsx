import { ProductListing } from "@/Product/Listing"
import { productFullInfoAtom, productAtom } from "@/Product/atoms"
import { BaseInfoKey } from "@/RpcClient"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { createFileRoute } from "@tanstack/react-router"
import * as Option from "effect/Option"

export const Route = createFileRoute("/product/$id")({
  component: ProductScreen,
})

export function ProductScreen() {
  const { id } = Route.useParams()
  const product = useAtomValue(productAtom(new BaseInfoKey({ id })))
  const fullInfo = Result.value(useAtomValue(productFullInfoAtom(id)))
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
