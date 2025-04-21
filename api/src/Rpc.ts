import { RpcServer, RpcSerialization } from "@effect/rpc"
import { Rpcs } from "./domain/Rpc"
import { Effect, Layer, Stream } from "effect"
import { AuthLayer } from "./Auth"
import { HttpMiddleware, HttpRouter, HttpServer } from "@effect/platform"
import { NodeHttpServer } from "@effect/platform-node"
import { createServer } from "node:http"
import { Bunnings } from "./Bunnings"
import { Bazaar } from "./Bazaar"
import { ReviewsWithStats } from "./domain/Bazaar"

const Handlers = Rpcs.toLayer(
  Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const bazaar = yield* Bazaar
    return {
      login: () => Effect.void,
      search: ({ query }) => bunnings.search(query).pipe(Stream.orDie),
      productInfo: ({ id }) =>
        bunnings.productInfoWithPrice(id).pipe(Effect.orDie),
      productReviews: ({ id }) =>
        Effect.all(
          {
            reviews: bazaar.allReviews(id),
            stats: bazaar.overview(id),
          },
          { concurrency: 2 },
        ).pipe(
          Effect.orDie,
          Effect.map((_) => new ReviewsWithStats(_)),
        ),
    }
  }),
).pipe(Layer.provide([Bunnings.Default, Bazaar.Default]))

const RpcLayer = RpcServer.layer(Rpcs).pipe(
  Layer.provide(Handlers),
  Layer.provide(AuthLayer),
  Layer.provide(RpcServer.layerProtocolWebsocket({ path: "/rpc" })),
  Layer.provide(RpcSerialization.layerJson),
)

export const HttpLayer = HttpRouter.Default.unwrap((router) =>
  HttpRouter.use(router, HttpMiddleware.cors()).pipe(
    HttpServer.serve(HttpMiddleware.logger),
  ),
).pipe(
  HttpServer.withLogAddress,
  Layer.provide(RpcLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 })),
)
