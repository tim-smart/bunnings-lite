import { ProductBaseInfo } from "../../server/src/domain/Bunnings.ts"
import { productFulfillmentAtom } from "./atoms"
import { Badge } from "@/components/ui/badge"
import { MapPin } from "lucide-react"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import { useAtomValue } from "@effect/atom-react"

export function FulfillmentBadge({
  product,
  showAvailable,
}: {
  readonly product: ProductBaseInfo
  readonly showAvailable?: boolean
}) {
  const maybeResult = AsyncResult.getOrElse(
    useAtomValue(productFulfillmentAtom(product.id)),
    Option.none,
  )

  if (Option.isNone(maybeResult)) {
    return null
  }

  const fullfillment = maybeResult.value
  if (!fullfillment.isAvailable) {
    return (
      <Badge className="h-7 rounded-full border-0 bg-orange-100 px-2.5 text-orange-800 dark:bg-orange-400/15 dark:text-orange-300">
        Out of stock
      </Badge>
    )
  } else if (Option.isSome(fullfillment.location)) {
    const { aisle, bay } = fullfillment.location.value
    return (
      <Badge className="h-7 rounded-full border-0 bg-primary/10 px-2.5 text-primary tabular-nums">
        <MapPin />
        Aisle {aisle}/{bay}
      </Badge>
    )
  }

  if (!showAvailable) {
    return null
  }

  return (
    <Badge className="h-7 rounded-full border-0 bg-green-100 px-2.5 text-green-800 dark:bg-green-400/15 dark:text-green-300">
      Available
    </Badge>
  )
}
