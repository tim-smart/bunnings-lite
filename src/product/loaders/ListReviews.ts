import { Effect, Option, Schema } from "effect"
import { Loader } from "@effect/ui"
import { ProductReview } from "../../../server/src/domain/Bazaar.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { ReviewFeed } from "../services/ReviewFeed.ts"

const ReviewPage = Schema.Struct({
  reviews: Schema.Array(ProductReview),
  done: Schema.Boolean,
})

/** A product's reviews, a batch at a time. The cursor counts the batches. */
export class ListReviews extends Loader.ListService<ListReviews>()(
  "product/ListReviews",
  {
    args: { id: Schema.String },
    page: ReviewPage,
    items: (page) => page.reviews,
    key: (review) => review.Id,
    error: ApiError,
    cursor: Schema.Number,
    next: (lastPage, allPages) =>
      lastPage.done ? Option.none() : Option.some(allPages.length),
    // A refetch restarts the server's stream, so it isn't worth doing often
    staleTime: "1 hour",
  },
  Effect.gen(function* () {
    const feed = yield* ReviewFeed
    return ({ id }, cursor) => feed.next(id, Option.isNone(cursor))
  }),
) {}
