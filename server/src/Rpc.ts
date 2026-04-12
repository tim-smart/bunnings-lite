import { RpcServer, RpcSerialization } from "effect/unstable/rpc"
import { Rpcs } from "./domain/Rpc.ts"
import { Effect, Layer, Option, Stream } from "effect"
import { AuthLayer } from "./Auth.ts"
import { NodeHttpServer } from "@effect/platform-node"
import { createServer } from "node:http"
import { Bunnings } from "./Bunnings.ts"
import { Bazaar } from "./Bazaar.ts"
import {
  CurrentSession,
  FulfillmentInfoWithLocation,
} from "./domain/Bunnings.ts"
import { Sessions } from "./Sessions.ts"
import * as HttpRouter from "effect/unstable/http/HttpRouter"

const Handlers = Rpcs.toLayer(
  Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const bazaar = yield* Bazaar
    const sessions = yield* Sessions
    return Rpcs.of({
      login: Effect.fnUntraced(function* ({ location }) {
        const session = yield* CurrentSession
        if (Option.isSome(location)) {
          yield* sessions.setLocation(session.id, location.value)
        }
        return session
      }),
      search: (request) => bunnings.search(request).pipe(Effect.orDie),
      productInfo: ({ id }) =>
        bunnings.productInfoWithPrice(id).pipe(Effect.orDie),
      productReviews: ({ id }) => bazaar.reviews(id).pipe(Stream.orDie),
      productReviewStats: ({ id }) => bazaar.overview(id).pipe(Effect.orDie),
      fulfillment: Effect.fnUntraced(function* ({ id }) {
        const [fulfillment, location] = yield* Effect.all(
          [bunnings.fulfillment(id), bunnings.productLocation(id)],
          { concurrency: 2 },
        )
        return Option.map(
          fulfillment,
          (fulfillment) =>
            new FulfillmentInfoWithLocation({
              fulfillment,
              location: Option.map(location, (_) => _[0]),
            }),
        )
      }, Effect.orDie),
      stores: (req) => bunnings.stores(req).pipe(Stream.orDie),
    })
  }),
).pipe(Layer.provide([Bunnings.layer, Bazaar.layer, Sessions.layer]))

const RpcRoute = RpcServer.layerHttp({
  group: Rpcs,
  path: "/rpc",
}).pipe(
  Layer.provide(Handlers),
  Layer.provide(AuthLayer),
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(HttpRouter.cors()),
)

export const HttpLayer = HttpRouter.serve(RpcRoute).pipe(
  Layer.provide(
    NodeHttpServer.layer(createServer, {
      port: 3000,
      disablePreemptiveShutdown: true,
    }),
  ),
)
