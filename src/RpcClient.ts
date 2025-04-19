import { RpcClient, RpcMiddleware, RpcSerialization } from "@effect/rpc"
import { Effect, Layer } from "effect"
import { Rpcs } from "../api/src/domain/Rpc"
import { Socket } from "@effect/platform"
import { AuthMiddleware } from "../api/src/domain/Auth"

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

export class BunningsClient extends Effect.Service<BunningsClient>()(
  "app/BunningsClient",
  {
    scoped: RpcClient.make(Rpcs),
    dependencies: [
      RpcClient.layerProtocolSocket.pipe(
        Layer.provide(RpcSerialization.layerJson),
        Layer.provide(Socket.layerWebSocket("ws://localhost:3000/rpc")),
        Layer.provide(Socket.layerWebSocketConstructorGlobal),
      ),
      AuthLayer,
    ],
  },
) {}
