import * as Schema from "effect/Schema"
import { CurrentSession } from "./Bunnings.ts"
import * as RpcMiddleware from "effect/unstable/rpc/RpcMiddleware"

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  {},
) {}

export class AuthMiddleware extends RpcMiddleware.Service<
  AuthMiddleware,
  {
    provides: CurrentSession
  }
>()("app/Auth/AuthMiddleware", {
  error: Unauthorized,
  requiredForClient: true,
}) {}
