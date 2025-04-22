import {
  Result,
  useRx,
  useRxRef,
  useRxSet,
  useRxValue,
} from "@effect-rx/rx-react"
import { queryIsSetRx, resultsRx } from "./rx"
import { Cause, Option } from "effect"
import { ProductBaseInfo } from "../../api/src/domain/Bunnings"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "@tanstack/react-router"
import { preloadRx, productFulfillmentRx } from "@/Product/rx"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { BaseInfoKey } from "@/RpcClient"
import { StarRating } from "@/components/ui/star-rating"
import { StoreSelector } from "@/Stores/Selector"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/Favorites/Button"
import { useFavoritesRef } from "@/Favorites/rx"
import { Button } from "@/components/ui/button"
import { useScrollBottom } from "@/lib/useScrollBottom"

export function SearchResults() {
  const queryIsSet = useRxValue(queryIsSetRx)
  const [result, pull] = useRx(resultsRx)
  useScrollBottom(() => {
    pull()
  })

  if (!queryIsSet) {
    return <NoResults />
  }

  if (result._tag === "Failure" && Cause.isDie(result.cause)) {
    throw Cause.squash(result.cause)
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 py-4 sm:py-10">
      {result._tag !== "Success" || result.waiting
        ? Array.from({ length: 9 }, (_, i) => <SkeletonCard key={String(i)} />)
        : result.value.items.map((result, i) => (
            <ResultCard key={i} product={result} />
          ))}
    </div>
  )
}

function ResultCard({ product }: { readonly product: ProductBaseInfo }) {
  const preload = useRxSet(preloadRx)

  const onTouchStart = useCallback(() => {
    preload(new BaseInfoKey({ id: product.id, result: product }))
  }, [product])

  return (
    <Link
      to={`/product/$id`}
      params={{ id: product.id }}
      search={(current) => current}
      onMouseDown={onTouchStart}
    >
      <Card className="relative">
        <div className="absolute top-2 left-2 right-2 flex">
          <FavoriteButton product={product} variant="icon" />
          <div className="flex-1" />
          <FulfillmentBadge product={product} />
        </div>
        <div className="h-32 sm:h-48">
          <img
            src={product.images[0].thumbnailUrl}
            alt={product.title}
            className="h-full mx-auto"
          />
        </div>
        <CardHeader className="px-4">
          <CardTitle>{product.title}</CardTitle>
          <CardDescription>
            ${product.price}
            <div className="h-1" />
            <StarRating rating={product.rating} />
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
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

  return null
}

function NoResults() {
  return (
    <div className="flex flex-col items-start py-10 gap-10">
      <div className="flex flex-col max-w-sm w-full">
        <Label className="text-[#0D5257]">Select your store:</Label>
        <div className="h-2" />
        <StoreSelector />
      </div>

      <FavoritesList />
    </div>
  )
}

function FavoritesList() {
  const ref = useFavoritesRef()
  const favorites = useRxRef(ref)

  if (favorites.length === 0) {
    return null
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <Label className="text-[#0D5257]">
        Favourites:
        <Button variant="link" className="p-0 m-0" onClick={() => ref.set([])}>
          (clear all)
        </Button>
      </Label>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {favorites.map((result, i) => (
          <ResultCard key={i} product={result} />
        ))}
      </div>
    </div>
  )
}
