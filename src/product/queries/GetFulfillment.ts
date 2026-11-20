import { Effect, Schema } from "effect"
import { Query } from "@effect/ui"
import { FulfillmentInfoWithLocation } from "../../../server/src/domain/Bunnings.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { SessionTag } from "../../rpc/domain/SessionTag.ts"
import { Session } from "../../rpc/services/Session.ts"

/** Whether the chosen store has a product, and where in the store it is. */
export class GetFulfillment extends Query.Service<GetFulfillment>()(
  "product/GetFulfillment",
  {
    args: { id: Schema.String },
    success: Schema.Option(FulfillmentInfoWithLocation),
    error: ApiError,
    staleTime: "15 minutes",
    tags: [SessionTag],
  },
  Effect.gen(function* () {
    const session = yield* Session
    return ({ id }) => session.use((client) => client.fulfillment({ id }))
  }),
) {}
