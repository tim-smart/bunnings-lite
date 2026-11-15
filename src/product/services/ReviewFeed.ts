import { Context, Effect, Exit, Layer, Pull, Scope, Stream } from "effect"
import type { ProductReview } from "../../../server/src/domain/Bazaar.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { Session } from "../../rpc/services/Session.ts"

export interface ReviewBatch {
  readonly reviews: ReadonlyArray<ProductReview>
  /** Whether these were the last reviews. */
  readonly done: boolean
}

// Enough reviews to be worth showing as one page
const batchSize = 12

/**
 * A product's reviews, as the server streams them. The stream stays open
 * between batches, so the server only fetches as far as the page has
 * scrolled.
 */
export class ReviewFeed extends Context.Service<
  ReviewFeed,
  {
    /**
     * The next reviews of a product. `restart` starts its stream again from
     * the first review.
     */
    readonly next: (
      id: string,
      restart: boolean,
    ) => Effect.Effect<ReviewBatch, ApiError>
  }
>()("product/ReviewFeed") {
  static readonly layer = Layer.effect(
    ReviewFeed,
    Effect.gen(function* () {
      const session = yield* Session
      const scope = yield* Effect.scope
      type Feed = {
        readonly scope: Scope.Closeable
        readonly pull: Pull.Pull<ReadonlyArray<ProductReview>, ApiError>
      }
      const feeds = new Map<string, Feed>()

      const open = Effect.fnUntraced(function* (id: string) {
        const previous = feeds.get(id)
        if (previous !== undefined) {
          yield* Scope.close(previous.scope, Exit.void)
        }
        const feedScope = yield* Scope.fork(scope)
        const pull = yield* Stream.toPull(
          session.stream((client) => client.productReviews({ id })),
        ).pipe(Effect.provideService(Scope.Scope, feedScope))
        const feed: Feed = { scope: feedScope, pull }
        feeds.set(id, feed)
        return feed
      })

      return {
        next: Effect.fnUntraced(function* (id, restart) {
          const feed =
            restart || !feeds.has(id) ? yield* open(id) : feeds.get(id)!
          const reviews: Array<ProductReview> = []
          let done = false
          while (!done && reviews.length < batchSize) {
            const chunk = yield* feed.pull.pipe(
              Pull.catchDone(() => Effect.succeed(undefined)),
            )
            if (chunk === undefined) done = true
            else reviews.push(...chunk)
          }
          return { reviews, done }
        }),
      }
    }),
  )
}
