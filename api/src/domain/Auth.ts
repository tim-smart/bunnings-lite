import { RpcMiddleware } from "@effect/rpc"
import { Schema } from "effect"
import { CurrentSession } from "./Bunnings"

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
) {}

export class AuthMiddleware extends RpcMiddleware.Tag<AuthMiddleware>()(
  "app/Auth/AuthMiddleware",
  {
    provides: CurrentSession,
    failure: Unauthorized,
    requiredForClient: true,
  },
) {}
