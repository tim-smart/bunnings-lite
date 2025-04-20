import { Rpc, RpcGroup } from "@effect/rpc"
import { AuthMiddleware } from "./Auth"
import { Schema } from "effect"
import { SearchResponse } from "./Bunnings"

export class Rpcs extends RpcGroup.make(
  Rpc.make("login"),
  Rpc.make("search", {
    payload: {
      query: Schema.String,
      offset: Schema.Int,
    },
    success: SearchResponse,
  }),
).middleware(AuthMiddleware) {}
