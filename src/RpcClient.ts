import * as Socket from "@effect/platform/Socket"
import * as RpcClient from "@effect/rpc/RpcClient"
import * as RpcMiddleware from "@effect/rpc/RpcMiddleware"
import * as RpcSerialization from "@effect/rpc/RpcSerialization"
import * as Config from "effect/Config"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Hash from "effect/Hash"
import * as Layer from "effect/Layer"
import { ProductBaseInfo } from "server/src/domain/Bunnings"
import { AuthMiddleware } from "../server/src/domain/Auth"
import { Rpcs } from "../server/src/domain/Rpc"

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
      RpcClient.layerProtocolSocket({ retryTransientErrors: true }).pipe(
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
