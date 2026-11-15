import { Effect, Schema } from "effect"
import { Loader } from "@effect/ui"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { KnownProducts } from "../services/KnownProducts.ts"

/**
 * What a search or the favourites already said about a product, if they
 * mentioned it. It never asks the server.
 */
export class GetKnownProduct extends Loader.Service<GetKnownProduct>()(
  "product/GetKnownProduct",
  {
    args: { id: Schema.String },
    success: Schema.Option(ProductBaseInfo),
    error: Schema.Never,
    staleTime: "5 minutes",
  },
  Effect.gen(function* () {
    const known = yield* KnownProducts
    return ({ id }) => Effect.sync(() => known.find(id))
  }),
) {}
