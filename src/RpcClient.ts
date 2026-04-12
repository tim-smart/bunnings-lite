import * as Socket from "effect/unstable/socket/Socket"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcMiddleware from "effect/unstable/rpc/RpcMiddleware"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import * as Config from "effect/Config"
import * as Data from "effect/Data"
import * as Effect from "effect/Effect"
import * as Equal from "effect/Equal"
import * as Hash from "effect/Hash"
import * as Layer from "effect/Layer"
import { ProductBaseInfo } from "../server/src/domain/Bunnings.ts"
import { AuthMiddleware } from "../server/src/domain/Auth"
import { Rpcs } from "../server/src/domain/Rpc.ts"
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc"
import * as BrowserSocket from "@effect/platform-browser/BrowserSocket"

const AuthLayer = RpcMiddleware.layerClient(
  AuthMiddleware,
  Effect.sync(() => {
    const sessionId =
      localStorage.getItem("sessionId") ??
      String(Math.round(Math.random() * 10000000000))
    localStorage.setItem("sessionId", sessionId)
    return ({ request, next }) =>
      next({
        ...request,
        headers: {
          ...request.headers,
          "session-id": sessionId,
        },
      })
  }),
)

const SocketLayer = Layer.unwrap(
  Effect.gen(function* () {
    const url = yield* Config.string("VITE_API_URL")
    return BrowserSocket.layerWebSocket(url)
  }),
)

export class BunningsClient extends AtomRpc.Service<BunningsClient>()(
  "BunningsClient",
  {
    group: Rpcs,
    protocol: RpcClient.layerProtocolSocket({
      retryTransientErrors: true,
    }).pipe(
      Layer.provide(RpcSerialization.layerJson),
      Layer.provide(SocketLayer),
      Layer.provide(Socket.layerWebSocketConstructorGlobal),
      Layer.merge(AuthLayer),
      Layer.orDie,
    ),
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
