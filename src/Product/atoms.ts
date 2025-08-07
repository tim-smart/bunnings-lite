import { Result, Atom } from "@effect-atom/atom-react"
import { BaseInfoKey, BunningsClient } from "@/RpcClient"
import { currentLocationAtom } from "@/Stores/atoms"
import { ProductBaseInfo } from "server/src/domain/Bunnings"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"

const runtimeAtom = Atom.runtime(BunningsClient.Default)

export const preloadAtom = Atom.fnSync((key: BaseInfoKey, get) => {
  get(productAtom(key))
  get(productFulfillmentAtom(key.id))
  get(productReviewStatsAtom(key.id))
  get(productReviewsAtom(key.id))
})

export const productAtom = Atom.family((key: BaseInfoKey) =>
  Atom.make((get) => {
    const fullInfo = get(productFullInfoAtom(key.id))
    if (key.result && fullInfo._tag !== "Success") {
      return Result.success(key.result)
    }
    return Result.map(fullInfo, (_) => _.asBaseInfo)
  }).pipe(Atom.setIdleTTL("5 minutes")),
)

export const productFullInfoAtom = Atom.family((id: string) =>
  runtimeAtom
    .atom(
      Effect.gen(function* () {
        const products = yield* BunningsClient
        return yield* products.productInfo({ id })
      }),
    )
    .pipe(Atom.setIdleTTL("10 minutes")),
)

export const productReviewStatsAtom = Atom.family((id: string) =>
  runtimeAtom.atom(BunningsClient.use((_) => _.productReviewStats({ id }))).pipe(
    Atom.map((_) => Option.flatten(Result.value(_))),
    Atom.setIdleTTL("10 minutes"),
  ),
)

export const productReviewCountAtom = Atom.family((product: ProductBaseInfo) =>
  Atom.make((get) => {
    const stats = get(productReviewStatsAtom(product.id))
    return Option.isSome(stats)
      ? stats.value.ReviewStatistics.TotalReviewCount
      : product.numberOfReviews
  }),
)

export const productRatingAtom = Atom.family((product: ProductBaseInfo) =>
  Atom.make((get) => {
    const stats = get(productReviewStatsAtom(product.id))
    return Option.isSome(stats)
      ? stats.value.ReviewStatistics.AverageOverallRating
      : product.rating
  }),
)

export const productReviewsAtom = Atom.family((id: string) =>
  runtimeAtom
    .pull(
      Effect.gen(function* () {
        const products = yield* BunningsClient
        return products.productReviews({ id })
      }).pipe(Stream.unwrap),
    )
    .pipe(Atom.setIdleTTL("5 minutes")),
)

export const productFulfillmentAtom = Atom.family((id: string) =>
  runtimeAtom
    .atom(
      Effect.fnUntraced(function* (get: Atom.Context) {
        get(currentLocationAtom)
        const products = yield* BunningsClient
        return yield* products.fulfillment({ id })
      }),
    )
    .pipe(Atom.setIdleTTL("15 minutes")),
)
