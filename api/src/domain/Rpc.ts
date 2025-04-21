import { Rpc, RpcGroup } from "@effect/rpc"
import { AuthMiddleware } from "./Auth"
import { Schema } from "effect"
import { ProductPriceInfo, SearchResult } from "./Bunnings"
import { ReviewsWithStats } from "./Bazaar"

export class Rpcs extends RpcGroup.make(
  Rpc.make("login"),
  Rpc.make("search", {
    payload: {
      query: Schema.String,
    },
    stream: true,
    success: SearchResult,
  }),
  Rpc.make("productInfo", {
    payload: {
      id: Schema.String,
    },
    success: ProductPriceInfo,
  }),
  Rpc.make("productReviews", {
    payload: {
      id: Schema.String,
    },
    success: ReviewsWithStats,
  }),
).middleware(AuthMiddleware) {}
