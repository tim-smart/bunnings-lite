import { Result, useRx, useRxSet, useRxValue } from "@effect-rx/rx-react"
import { allFilters, focusRx, queryIsSetRx, resultsRx } from "./rx"
import { Array, Cause, Option } from "effect"
import { ProductBaseInfo } from "../../api/src/domain/Bunnings"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, useNavigate } from "@tanstack/react-router"
import { preloadRx } from "@/Product/rx"
import { useCallback, useEffect, useRef, useState } from "react"
import { BaseInfoKey } from "@/RpcClient"
import { StarRating } from "@/components/ui/star-rating"
import { StoreSelector } from "@/Stores/Selector"
import { Label } from "@/components/ui/label"
import { FavoriteButton } from "@/Favorites/Button"
import { Button } from "@/components/ui/button"
import { useScrollBottom } from "@/lib/useScrollBottom"
import { ArrowUp } from "lucide-react"
import { favoritesRx } from "@/Favorites"
import { InstallButton } from "@/App/InstallButton"
import { FulfillmentBadge } from "@/Product/FulfillmentBadge"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"

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
    <>
      {hasResults && <Filters />}
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 py-4 sm:py-10">
        {hasResults
          ? result.value.items.map((result) => (
              <ResultCard key={result.id} product={result} />
            ))
          : Array.makeBy(9, (i) => <SkeletonCard key={String(i)} />)}
        <div className="fixed bottom-0 right-0 p-6 pb-safe flex flex-col transform-gpu">
          <BackToTop />
          <div className="h-6" />
        </div>
      </div>
    </>
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
        if (e.button === 0) {
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

function Filters() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 sm:gap-4 px-4 sm:px-0">
      {Object.values(allFilters).map((filter) => (
        <FilterSlider key={filter.filter.id} filter={filter} />
      ))}
    </div>
  )
}

type AllFilters = typeof allFilters

function FilterSlider({ filter }: { filter: AllFilters[keyof AllFilters] }) {
  const range = useRxValue(filter.facet)
  const [min, setMin] = useRx(filter.min)
  const [max, setMax] = useRx(filter.max)
  const [value, setRange] = useRx(filter.value)
  const reset = useRxSet(filter.reset)

  const minInput = useRef<HTMLInputElement>(null)
  const maxInput = useRef<HTMLInputElement>(null)

  return Option.match(range, {
    onNone: () => null,
    onSome: ({ start, end }) => (
      <div className="flex flex-col pt-4 sm:pt-10">
        <Label className="text-primary">
          {filter.filter.name}:
          {Option.match(value, {
            onNone: () => null,
            onSome: () => (
              <span
                onClick={() => reset()}
                className="text-gray-600 cursor-pointer"
              >
                (clear)
              </span>
            ),
          })}
        </Label>
        {filter.filter.kind === "slider" ? (
          <>
            <div className="h-3 md:h-[18px]" />
            <Slider
              min={Math.floor(start)}
              max={Math.ceil(end)}
              value={[
                Option.getOrElse(min, () => Math.floor(start)),
                Option.getOrElse(max, () => Math.ceil(end)),
              ]}
              onValueChange={([min, max]) => {
                setMin(min)
                setMax(max)
              }}
              onValueCommit={([min, max]) => {
                setRange(Option.some([min, max]))
              }}
              formatValue={(value) => `${filter.filter.valuePrefix}${value}`}
            />
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              minInput.current?.blur()
              maxInput.current?.blur()
              setRange(
                Option.some([
                  Option.getOrElse(min, () => Math.floor(start)),
                  Option.getOrElse(max, () => Math.ceil(end)),
                ]),
              )
            }}
          >
            <div className="h-1" />
            <div className="flex gap-2 items-center">
              <Input
                ref={minInput}
                type="number"
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setMin(isNaN(value) ? Math.floor(start) : value)
                }}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (isNaN(value)) return
                  setRange(
                    Option.some([
                      value,
                      Option.getOrElse(max, () => Math.ceil(end)),
                    ]),
                  )
                }}
                value={Option.getOrElse(min, () => "")}
                placeholder={`${filter.filter.valuePrefix}${Math.floor(start)}`}
              />
              <div className="w-20 flex items-center">
                <hr className="h-[5px] bg-gray-600 w-full" />
              </div>
              <Input
                ref={maxInput}
                type="number"
                onChange={(e) => {
                  const value = Number(e.target.value)
                  setMax(isNaN(value) ? Math.ceil(end) : value)
                }}
                onBlur={(e) => {
                  const value = Number(e.target.value)
                  if (isNaN(value)) return
                  setRange(
                    Option.some([
                      Option.getOrElse(min, () => Math.floor(start)),
                      value,
                    ]),
                  )
                }}
                value={Option.getOrElse(max, () => "")}
                placeholder={`${filter.filter.valuePrefix}${Math.ceil(end)}`}
              />
            </div>
            <button type="submit" className="hidden">
              Submit
            </button>
          </form>
        )}
      </div>
    ),
  })
}

function NoResults() {
  return (
    <div className="flex flex-col items-start py-10 gap-10">
      <div className="flex flex-col max-w-sm w-full">
        <Label className="text-primary">Select your store:</Label>
        <div className="h-2" />
        <StoreSelector />
      </div>

      <FavoritesList />

      <div className="fixed bottom-0 right-0 p-4 pb-safe flex flex-col">
        <InstallButton />
        <div className="h-4" />
      </div>
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
      <div className="text-primary font-medium text-sm flex gap-2">
        Favourites:
        <span
          onClick={() => setFavorites([])}
          className="text-gray-600 cursor-pointer"
        >
          (clear all)
        </span>
      </div>
      <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
      className="bg-primary text-white cursor-pointer hover:bg-primary/90"
      size="lg"
    >
      <ArrowUp strokeWidth={3} />
    </Button>
  )
}
