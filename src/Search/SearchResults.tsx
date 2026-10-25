import { RegistryContext, useAtomSet, useAtomValue } from "@effect/atom-react"
import { focusAtom, queryIsSetAtom, resultsAtom } from "./atoms"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings.ts"
import { Card, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link, useElementScrollRestoration } from "@tanstack/react-router"
import { preloadAtom } from "@/Product/atoms"
import { useCallback, useContext, useEffect, useRef, useState } from "react"
import { BaseInfoKey } from "@/RpcClient"
import { StarRating } from "@/components/ui/star-rating"
import { StoreSelector } from "@/Stores/Selector"
import { FavoriteButton } from "@/Favorites/Button"
import { Button } from "@/components/ui/button"
import { useScrollBottom } from "@/lib/useScrollBottom"
import { ArrowUp, SearchX, Star } from "lucide-react"
import { clearFavoritesAtom, favoritesAtom } from "@/Favorites/atoms"
import { InstallButton } from "@/App/InstallButton"
import { FulfillmentBadge } from "@/Product/FulfillmentBadge"
import { Filters } from "./Filters"
import * as Array from "effect/Array"
import * as Cause from "effect/Cause"
import { router } from "@/Router"
import { formatPrice } from "@/lib/utils"
import { useWindowVirtualizer } from "@tanstack/react-virtual"
import * as Atom from "effect/reactivity/Atom"
import * as AsyncResult from "effect/reactivity/AsyncResult"

export function SearchResults() {
  const queryIsSet = useAtomValue(queryIsSetAtom)
  const results = useAtomValue(resultsAtom)
  const pull = useAtomSet(resultsAtom)
  useScrollBottom(() => {
    pull()
  })

  if (!queryIsSet) {
    return <StoreAndFavourites />
  }

  return (
    <>
      <div className="h-4 sm:h-6" />
      {AsyncResult.isSuccess(results) && <Filters />}
      <div className="h-3 sm:h-4" />
      {AsyncResult.builder(results)
        .onSuccess(({ items }) => <ResultsGrid results={items} />)
        .onInitial(() => <ResultsSkeleton />)
        .onErrorTag("EmptyQueryError", () => <ResultsSkeleton />)
        .onErrorTag("NoSuchElementError", () => <NoResults />)
        .onFailure((cause) => (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-bold text-accent">
              An error occurred while fetching results.
            </h2>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap text-left text-xs text-muted-foreground">
              {Cause.pretty(cause)}
            </pre>
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
            className="flex gap-2 pb-2 sm:gap-4 sm:pb-4"
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
              return <ResultCard key={product.id ?? index} product={product} />
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
    <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.makeBy(8, (i) => (
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
      className="group flex-1 min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-primary/40"
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
      <Card className="@container/card relative h-full gap-0 overflow-hidden py-0 transition-[box-shadow] group-hover:ring-2 group-hover:ring-primary/15">
        <div className="absolute top-1 left-1 z-10">
          <FavoriteButton product={product} variant="icon" />
        </div>
        {/* Product photos are shot on white, so they sit in a light well that
            the dark theme keeps instead of leaving ragged white rectangles */}
        <div className="h-36 px-3 pt-10 pb-2 sm:h-52 sm:px-4">
          <div className="flex h-full items-center justify-center rounded-lg bg-image-well px-1 text-image-well-foreground sm:px-2">
            <img
              src={product.images[0].thumbnailUrl}
              alt={product.title}
              className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-[1.03] dark:brightness-90"
            />
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 px-3 pt-2 pb-3 sm:px-4 sm:pb-4">
          {/* Beside the favourite button when the card has room, otherwise
              above the title so neither squeezes the other */}
          <div className="absolute top-2 right-2 z-10 empty:hidden @max-[11rem]/card:static">
            <FulfillmentBadge product={product} />
          </div>
          <CardTitle className="line-clamp-3 sm:line-clamp-2 h-[3lh] sm:h-[2lh] text-sm sm:text-[15px] leading-snug font-medium text-foreground group-hover:text-primary">
            {product.title}
          </CardTitle>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <span className="text-lg font-bold tabular-nums text-foreground sm:text-xl">
              {formatPrice(product.price)}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              <StarRating size="sm" rating={product.rating} />
              <span>({product.numberOfReviews})</span>
            </span>
          </div>
        </div>
      </Card>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card p-3 sm:p-4">
      <Skeleton className="h-28 w-full sm:h-44" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-6 w-1/3" />
    </div>
  )
}

function NoResults() {
  const focus = useAtomSet(focusAtom)
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-card px-6 py-14 text-center">
      <SearchX className="size-8 text-primary/60" />
      <h2 className="text-lg font-bold">No results found.</h2>
      <p className="text-sm text-muted-foreground">
        Check the spelling or try a broader term.
      </p>
      <Button className="mt-3" onClick={() => focus()}>
        Try another search
      </Button>
    </div>
  )
}

function StoreAndFavourites() {
  return (
    <div className="flex flex-col pt-6 pb-10 gap-8 sm:pt-8 sm:gap-10">
      <section
        aria-labelledby="store-heading"
        className="grid gap-4 rounded-xl bg-card p-4 sm:p-6 md:grid-cols-[1fr_minmax(0,24rem)] md:items-center md:gap-8"
      >
        <div className="flex flex-col gap-1">
          <h2 id="store-heading" className="text-lg font-bold text-primary">
            Your store
          </h2>
          <p className="text-sm text-muted-foreground">
            Stock levels and aisle locations are shown for this store.
          </p>
        </div>
        <StoreSelector />
      </section>

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
    AsyncResult.getOrElse(() => []),
  )
  const clear = useAtomSet(clearFavoritesAtom)

  if (favorites.length === 0) {
    return (
      <section
        aria-labelledby="favourites-heading"
        className="flex flex-col items-center gap-2 rounded-xl bg-card/60 px-6 py-10 text-center"
      >
        <Star className="size-7 text-accent" />
        <h2 id="favourites-heading" className="font-bold">
          No favourites yet
        </h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tap the star on any product to keep it here for your next trip.
        </p>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="favourites-heading"
      className="w-full flex flex-col gap-4"
    >
      <div className="flex items-center justify-between gap-4">
        <h2
          id="favourites-heading"
          className="flex items-center gap-2 text-lg font-bold text-primary"
        >
          Favourites{" "}
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold tabular-nums">
            {favorites.length}
          </span>
        </h2>
        <button
          type="button"
          onClick={() => clear()}
          className="cursor-pointer rounded-sm text-sm font-medium text-muted-foreground underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          Clear all
        </button>
      </div>
      <div className="grid gap-2 sm:gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {favorites.map((result, i) => (
          <ResultCard key={i} product={result} />
        ))}
      </div>
    </section>
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
      aria-label="Back to top"
      className="size-12 cursor-pointer rounded-full shadow-lg shadow-primary/25 animate-in fade-in zoom-in-90"
    >
      <ArrowUp strokeWidth={2.5} className="size-5" />
    </Button>
  )
}
