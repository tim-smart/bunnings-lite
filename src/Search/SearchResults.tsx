import { useRx, useRxSet, useRxValue } from "@effect-rx/rx-react"
import { queryIsSetRx, resultsRx } from "./rx"
import { Cause } from "effect"
import { SearchResult } from "../../api/src/domain/Bunnings"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "@tanstack/react-router"
import { preloadRx } from "@/Product/rx"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { BaseInfoKey } from "@/RpcClient"
import { StarRating } from "@/components/ui/star-rating"

export function SearchResults() {
  const queryIsSet = useRxValue(queryIsSetRx)
  const [result, pull] = useRx(resultsRx)
  useScrollBottom(() => {
    pull()
  })

  if (!queryIsSet) {
    return null
  }

  if (result._tag === "Failure") {
    throw Cause.squash(result.cause)
  }

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 py-4 sm:py-10">
      {result._tag === "Initial" || result.waiting
        ? Array.from({ length: 9 }, (_, i) => <SkeletonCard key={String(i)} />)
        : result.value.items.map((result, i) => (
            <ResultCard key={i} result={result} />
          ))}
    </div>
  )
}

function ResultCard({ result }: { readonly result: SearchResult }) {
  const preload = useRxSet(preloadRx)

  const onTouchStart = useCallback(() => {
    preload(new BaseInfoKey({ id: result.permanentid, result }))
  }, [result])

  return (
    <Link to={`/product/${result.permanentid}`} onMouseDown={onTouchStart}>
      <Card>
        <div className="h-32 sm:h-48">
          <img
            src={result.thumbnailimageurl}
            alt={result.title}
            className="h-full mx-auto"
          />
        </div>
        <CardHeader className="px-4">
          <CardTitle>{result.title}</CardTitle>
          <CardDescription>
            ${result.price_9454}
            <div className="h-1" />
            <StarRating rating={result.rating} />
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

function useScrollBottom(f: () => void) {
  const bottomRef = useRef(false)
  const fn = useMemo(() => f, [])

  useEffect(() => {
    const onscroll = () => {
      const scrolledTo = window.scrollY + window.innerHeight
      const threshold = 300
      const isReachBottom = document.body.scrollHeight - threshold <= scrolledTo
      if (isReachBottom && !bottomRef.current) {
        bottomRef.current = true
        fn()
      } else if (!isReachBottom) {
        bottomRef.current = false
      }
    }
    window.addEventListener("scroll", onscroll)
    return () => {
      window.removeEventListener("scroll", onscroll)
    }
  }, [bottomRef, fn])
}
