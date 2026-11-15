import { Context, Effect, Layer, Random } from "effect"
import { KeyValueStore } from "effect/persistence"
import { RpcClient, RpcMiddleware } from "effect/rpc"
import { AuthMiddleware } from "../../../server/src/domain/Auth.ts"
import { Rpcs } from "../../../server/src/domain/Rpc.ts"

// The server keeps one session per device, named by an id the device picks
// once and sends with every call.
const AuthLayer = RpcMiddleware.layerClient(
  AuthMiddleware,
  Effect.gen(function* () {
    const store = yield* KeyValueStore.KeyValueStore
    const saved = yield* Effect.orDie(store.get("sessionId"))
    const sessionId =
      saved ?? String(yield* Random.nextIntBetween(0, 10_000_000_000))
    if (saved === undefined) {
      yield* Effect.orDie(store.set("sessionId", sessionId))
    }
    return ({ request, next }) =>
      next({
        ...request,
        headers: { ...request.headers, "session-id": sessionId },
      })
  }),
)

/**
 * The RPC client for the Bunnings Lite server. The entry module provides the
 * transport (`RpcClient.Protocol`) and the key value store.
 */
export class BunningsClient extends Context.Service<BunningsClient>()(
  "rpc/BunningsClient",
  { make: RpcClient.make(Rpcs) },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(AuthLayer),
  )
}
