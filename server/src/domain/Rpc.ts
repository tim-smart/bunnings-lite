import { Rpc, RpcGroup } from "@effect/rpc"
import { AuthMiddleware } from "./Auth"
import { Schema } from "effect"
import {
  FulfillmentInfoWithLocation,
  ProductPriceInfo,
  SearchResponseData,
  Session,
  SessionLocation,
  Store,
} from "./Bunnings"
import { ProductReview, ReviewStats } from "./Bazaar"

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
      offset: Schema.Number,
      priceRange: Schema.Option(Schema.Tuple(Schema.Number, Schema.Number)),
      ratingRange: Schema.Option(Schema.Tuple(Schema.Number, Schema.Number)),
    },
    success: SearchResponseData,
  }),
  Rpc.make("productInfo", {
    payload: {
      id: Schema.String,
    },
    success: ProductPriceInfo,
  }),
  Rpc.make("productReviewStats", {
    payload: {
      id: Schema.String,
    },
    success: Schema.Option(ReviewStats),
  }),
  Rpc.make("productReviews", {
    payload: {
      id: Schema.String,
    },
    stream: true,
    success: ProductReview,
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
