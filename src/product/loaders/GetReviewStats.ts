import { Effect, Schema } from "effect"
import { Loader } from "@effect/ui"
import { ReviewStats } from "../../../server/src/domain/Bazaar.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { Session } from "../../rpc/services/Session.ts"

/** A product's average rating and how its ratings are spread. */
export class GetReviewStats extends Loader.Service<GetReviewStats>()(
  "product/GetReviewStats",
  {
    args: { id: Schema.String },
    success: Schema.Option(ReviewStats),
    error: ApiError,
    staleTime: "10 minutes",
  },
  Effect.gen(function* () {
    const session = yield* Session
    return ({ id }) =>
      session.use((client) => client.productReviewStats({ id }))
  }),
) {}
