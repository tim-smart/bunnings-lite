import { Result, useRx, useRxSet, useRxValue } from "@effect-rx/rx-react"
import { focusRx, queryIsSetRx, resultsRx } from "./rx"
import { Cause, Option } from "effect"
import { ProductBaseInfo } from "../../api/src/domain/Bunnings"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, useNavigate } from "@tanstack/react-router"
import { preloadRx, productFulfillmentRx } from "@/Product/rx"
import { useCallback, useEffect, useState } from "react"
import { BaseInfoKey } from "@/RpcClient"
import { StarRating } from "@/components/ui/star-rating"
import { StoreSelector } from "@/Stores/Selector"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/Favorites/Button"
import { Button } from "@/components/ui/button"
import { useScrollBottom } from "@/lib/useScrollBottom"
import { ArrowUp } from "lucide-react"
import { favoritesRx } from "@/Favorites"

export function SearchResults() {
  const queryIsSet = useRxValue(queryIsSetRx)
  const [result, pull] = useRx(resultsRx)
  useScrollBottom(() => {
    pull()
  })

  if (!queryIsSet) {
    return <NoResults />
  }

  if (result._tag === "Failure") {
    throw Cause.squash(result.cause)
  }

  const hasResults =
    Result.isSuccess(result) &&
    (result.value.items.length > 0 || !result.waiting)

  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 py-2 sm:py-10">
      {hasResults
        ? result.value.items.map((result) => (
            <ResultCard key={result.id} product={result} />
          ))
        : Array.from({ length: 9 }, (_, i) => <SkeletonCard key={String(i)} />)}
      <div className="fixed bottom-0 right-0 p-4 pb-safe flex flex-col">
        <BackToTop />
        <div className="h-4" />
      </div>
    </div>
  )
}

function ResultCard({ product }: { readonly product: ProductBaseInfo }) {
  const navigate = useNavigate()
  const preload = useRxSet(preloadRx)

  const onPointerDown = useCallback(() => {
    preload(new BaseInfoKey({ id: product.id, result: product }))
  }, [product])

  const onPointerUp = useCallback(() => {
    navigate({
      to: `/product/$id`,
      params: { id: product.id },
      search: (current) => current,
    })
  }, [product])

  return (
    <Link
      to={`/product/$id`}
      params={{ id: product.id }}
      search={(current) => current}
      onPointerDown={onPointerDown}
      onMouseDown={(e) => {
        if (e.button === 1) {
          onPointerUp()
        }
      }}
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
          <CardTitle className="line-clamp-3 sm:line-clamp-2 h-[3lh] sm:h-[2lh]">
            {product.title}
          </CardTitle>
          <CardDescription>
            ${product.price}
            <div className="h-1" />
            <div className="flex gap-2">
              <StarRating rating={product.rating} />
              <span>({product.numberOfReviews})</span>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col space-y-3">
      <Skeleton className="aspect-square w-full rounded-xl" />
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
  const [favorites, setFavorites] = useRx(favoritesRx)

  if (favorites.length === 0) {
    return null
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="text-[#0D5257] font-medium text-sm flex gap-2">
        Favourites:
        <span
          onClick={() => setFavorites([])}
          className="text-gray-600 cursor-pointer"
        >
          (clear all)
        </span>
      </div>
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {favorites.map((result, i) => (
          <ResultCard key={i} product={result} />
        ))}
      </div>
    </div>
  )
}

function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 200)
    }
    window.addEventListener("scroll", handleScroll)
    return () => {
      window.removeEventListener("scroll", handleScroll)
    }
  }, [])

  const scrollToTop = useRxSet(focusRx)

  if (!visible) {
    return null
  }

  return (
    <Button
      onClick={() => scrollToTop()}
      className="bg-[#0D5257] text-white cursor-pointer hover:bg-[#0D5257]/90"
    >
      <ArrowUp />
    </Button>
  )
}
