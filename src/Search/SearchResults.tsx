import {
  Atom,
  RegistryContext,
  Result,
  useAtomSet,
  useAtomValue,
} from "@effect-atom/atom-react"
import { focusAtom, queryIsSetAtom, resultsAtom } from "./atoms"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, useElementScrollRestoration } from "@tanstack/react-router"
import { preloadAtom } from "@/Product/atoms"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { BaseInfoKey } from "@/RpcClient"
import { StarRating } from "@/components/ui/star-rating"
import { StoreSelector } from "@/Stores/Selector"
import { Label } from "@/components/ui/label"
import { FavoriteButton } from "@/Favorites/Button"
import { Button } from "@/components/ui/button"
import { useScrollBottom } from "@/lib/useScrollBottom"
import { ArrowUp } from "lucide-react"
import { clearFavoritesAtom, favoritesAtom } from "@/Favorites/atoms"
import { InstallButton } from "@/App/InstallButton"
import { FulfillmentBadge } from "@/Product/FulfillmentBadge"
import { Filters } from "./Filters"
import * as Array from "effect/Array"
import * as Cause from "effect/Cause"
import { router } from "@/Router"
import { useWindowVirtualizer } from "@tanstack/react-virtual"

export function SearchResults() {
  const queryIsSet = useAtomValue(queryIsSetAtom)
  const results = useAtomValue(resultsAtom)
  const pull = useAtomSet(resultsAtom)
  useScrollBottom(() => {
    pull()
  })

  if (!queryIsSet) {
    return <NoResults />
  }

  return (
    <>
      <div className="h-4" />
      {Result.isSuccess(results) && <Filters />}
      <div className="h-4" />
      {Result.builder(results)
        .onSuccess(({ items }) => <ResultsGrid results={items} />)
        .onInitial(() => <ResultsSkeleton />)
        .onErrorTag("NoSuchElementException", () => <ResultsSkeleton />)
        .onFailure((cause) => (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <div className="text-red-500">
              An error occurred while fetching results.
            </div>
            {Cause.pretty(cause)}
          </div>
        ))
        .render()}
      <div className="fixed bottom-0 right-0 p-6 pb-safe flex flex-col transform-gpu">
        <BackToTop />
        <div className="h-6" />
      </div>
    </>
  )
}

let lastRowHeight = 350

function ResultsGrid({
  results,
}: {
  readonly results: Array<ProductBaseInfo>
}) {
  const ref = useRef<HTMLDivElement>(null)
  const columns = useAtomValue(columnsAtom)
  const scrollRestoration = useElementScrollRestoration({
    getElement: () => window,
  })

  const virtualizer = useWindowVirtualizer({
    initialOffset: scrollRestoration?.scrollY,
    count: Math.ceil(results.length / columns.length),
    estimateSize: () => lastRowHeight,
    overscan: 3,
    scrollMargin: ref.current?.offsetTop ?? 0,
  })

  return (
    <div ref={ref} className="relative">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            className="flex gap-2 pb-2"
            key={item.key}
            ref={(el) => {
              if (!el) return
              lastRowHeight = el.scrollHeight
              return virtualizer.measureElement(el)
            }}
            data-index={item.index}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${
                item.start - virtualizer.options.scrollMargin
              }px)`,
            }}
          >
            {columns.map((col) => {
              const index = item.index * columns.length + col
              const product = results[index]
              if (!product) return <div key={index} className="flex-1" />
              return <ResultCard key={index} product={product} />
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

const getColumns = (width: number): Array<number> => {
  if (width >= 1024) return Array.range(0, 3)
  if (width >= 768) return Array.range(0, 2)
  return Array.range(0, 1)
}

const columnsAtom = Atom.make((get) => {
  const onResize = () => {
    get.setSelf(getColumns(window.innerWidth))
  }
  window.addEventListener("resize", onResize)
  get.addFinalizer(() => window.removeEventListener("resize", onResize))
  return getColumns(window.innerWidth)
})

function ResultsSkeleton() {
  return (
    <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.makeBy(9, (i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  )
}

function ResultCard({ product }: { readonly product: ProductBaseInfo }) {
  const regisry = useContext(RegistryContext)

  const onPointerDown = useCallback(() => {
    regisry.set(
      preloadAtom,
      new BaseInfoKey({ id: product.id, result: product }),
    )
  }, [product])

  const onPointerUp = useCallback(() => {
    router.navigate({
      to: `/product/$id`,
      params: { id: product.id },
      search: (current) => current,
    })
  }, [product])

  return (
    <Link
      className="flex-1"
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
  const favorites = useAtomValue(
    favoritesAtom,
    Result.getOrElse(() => []),
  )
  const clear = useAtomSet(clearFavoritesAtom)

  if (favorites.length === 0) {
    return null
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="text-primary font-medium text-sm flex gap-2">
        Favourites:
        <span onClick={() => clear()} className="text-gray-600 cursor-pointer">
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

  const scrollToTop = useAtomSet(focusAtom)

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
