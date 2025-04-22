import { RpcClient, RpcMiddleware, RpcSerialization } from "@effect/rpc"
import {
  Cache,
  Config,
  ConfigProvider,
  Data,
  Effect,
  Equal,
  Hash,
  Layer,
} from "effect"
import { Rpcs } from "../api/src/domain/Rpc"
import { Socket } from "@effect/platform"
import { AuthMiddleware } from "../api/src/domain/Auth"
import { ProductBaseInfo } from "api/src/domain/Bunnings"

const AuthLayer = RpcMiddleware.layerClient(
  AuthMiddleware,
  Effect.gen(function* () {
    const sessionId =
      localStorage.getItem("sessionId") ??
      String(Math.round(Math.random() * 10000000000))
    localStorage.setItem("sessionId", sessionId)
    return Effect.fnUntraced(function* ({ request }) {
      return {
        ...request,
        headers: {
          ...request.headers,
          "session-id": sessionId,
        },
      }
    })
  }),
)

const SocketLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const url = yield* Config.string("VITE_API_URL")
    return Socket.layerWebSocket(url)
  }).pipe(Effect.withConfigProvider(ConfigProvider.fromJson(import.meta.env))),
)

export class BunningsClient extends Effect.Service<BunningsClient>()(
  "app/BunningsClient",
  {
    scoped: RpcClient.make(Rpcs),
    dependencies: [
      RpcClient.layerProtocolSocket.pipe(
        Layer.provide(RpcSerialization.layerJson),
        Layer.provide(SocketLayer),
        Layer.provide(Socket.layerWebSocketConstructorGlobal),
      ),
      AuthLayer,
    ],
  },
) {}

export class BaseInfoKey extends Data.Class<{
  id: string
  result?: ProductBaseInfo
}> {
  [Equal.symbol](that: BaseInfoKey) {
    return this.id === that.id
  }
  [Hash.symbol]() {
    return Hash.string(this.id)
  }
}

export class SearchQuery extends Data.Class<{
  query: string
  offset: number
}> {}

export class Products extends Effect.Service<Products>()("app/Products", {
  dependencies: [BunningsClient.Default],
  effect: Effect.gen(function* () {
    const client = yield* BunningsClient

    const baseInfoCache = yield* Cache.make({
      lookup: Effect.fnUntraced(function* (key: BaseInfoKey) {
        if (key.result) {
          return key.result
        }
        const result = yield* fullInfoCache.get(key.id)
        return result.asBaseInfo
      }),
      capacity: 1024,
      timeToLive: "15 minutes",
    })

    const fullInfoCache = yield* Cache.make({
      lookup: Effect.fnUntraced(function* (id: string) {
        return yield* client.productInfo({ id })
      }),
      capacity: 1024,
      timeToLive: "15 minutes",
    })

    const reviewCache = yield* Cache.make({
      lookup: (id: string) => client.productReviewStats({ id }),
      capacity: 1024,
      timeToLive: "15 minutes",
    })

    return {
      getBaseInfo: (key: BaseInfoKey) => baseInfoCache.get(key),
      getFullInfo: (id: string) => fullInfoCache.get(id),
      getReviewStats: (id: string) => reviewCache.get(id),
      getReviews: (id: string) => client.productReviews({ id }),
      getFulfillment: (id: string) => client.fulfillment({ id }),
    }
  }),
}) {}
