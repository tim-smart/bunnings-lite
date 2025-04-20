import { RpcServer, RpcSerialization } from "@effect/rpc"
import { Rpcs } from "./domain/Rpc"
import { Effect, Layer } from "effect"
import { AuthLayer } from "./Auth"
import { HttpMiddleware, HttpRouter, HttpServer } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { createServer } from "node:http"
import { Bunnings } from "./Bunnings"

const Handlers = Rpcs.toLayer(
  Effect.gen(function* () {
    const bunnings = yield* Bunnings
    return {
      login: () => Effect.void,
      search: ({ query, offset }) =>
        bunnings.search(query, offset).pipe(Effect.orDie),
    }
  }),
).pipe(Layer.provide(Bunnings.Default))

const RpcLayer = RpcServer.layer(Rpcs).pipe(
  Layer.provide(Handlers),
  Layer.provide(AuthLayer),
  Layer.provide(RpcServer.layerProtocolWebsocket({ path: "/rpc" })),
  Layer.provide(RpcSerialization.layerJson),
)

export const HttpLayer = HttpRouter.Default.serve(HttpMiddleware.logger).pipe(
  HttpServer.withLogAddress,
  Layer.provide(RpcLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
