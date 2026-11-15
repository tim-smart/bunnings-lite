import { Effect, Schema } from "effect"
import { Loader } from "@effect/ui"
import { ProductPriceInfo } from "../../../server/src/domain/Bunnings.ts"
import { ApiError } from "../../rpc/domain/ApiError.ts"
import { SessionTag } from "../../rpc/domain/SessionTag.ts"
import { Session } from "../../rpc/services/Session.ts"

/** A product's details and its price at the chosen store. */
export class GetProduct extends Loader.Service<GetProduct>()(
  "product/GetProduct",
  {
    args: { id: Schema.String },
    success: ProductPriceInfo,
    error: ApiError,
    staleTime: "10 minutes",
    tags: [SessionTag],
  },
  Effect.gen(function* () {
    const session = yield* Session
    return ({ id }) => session.use((client) => client.productInfo({ id }))
  }),
) {}
