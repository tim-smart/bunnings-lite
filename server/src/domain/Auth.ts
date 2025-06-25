import * as Schema from "effect/Schema"
import { CurrentSession } from "./Bunnings"
import * as RpcMiddleware from "@effect/rpc/RpcMiddleware"

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
