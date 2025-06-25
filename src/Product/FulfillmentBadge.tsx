import { ProductBaseInfo } from "server/src/domain/Bunnings"
import { Result, useRxValue } from "@effect-rx/rx-react"
import { productFulfillmentRx } from "./rx"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"
import * as Option from "effect/Option"

export function FulfillmentBadge({
  product,
  showAvailable,
}: {
  readonly product: ProductBaseInfo
  readonly showAvailable?: boolean
}) {
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
      <Badge variant="outline" className="bg-white/20 backdrop-blur-sm">
        <MapPin />
        Aisle {aisle}/{bay}
      </Badge>
    )
  }

  if (!showAvailable) {
    return null
  }

  return <Badge className="bg-green-500 text-white">Available</Badge>
}
