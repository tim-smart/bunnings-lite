import { Rpc, RpcGroup } from "@effect/rpc"
import { AuthMiddleware } from "./Auth"
import { Schema } from "effect"
import {
  FulfillmentInfo,
  FulfillmentInfoWithLocation,
  ProductBaseInfo,
  ProductPriceInfo,
  SearchResult,
  Session,
  SessionLocation,
  Store,
} from "./Bunnings"
import { ReviewsWithStats } from "./Bazaar"

export class Rpcs extends RpcGroup.make(
  Rpc.make("login", {
    payload: {
      location: Schema.Option(SessionLocation),
    },
    success: Session,
  }),
  Rpc.make("search", {
    payload: {
      query: Schema.String,
    },
    stream: true,
    success: ProductBaseInfo,
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
  Rpc.make("fulfillment", {
    payload: {
      id: Schema.String,
    },
    success: Schema.Option(FulfillmentInfoWithLocation),
  }),
  Rpc.make("stores", {
    payload: {
      latitude: Schema.Number,
      longitude: Schema.Number,
    },
    stream: true,
    success: Store,
  }),
).middleware(AuthMiddleware) {}
