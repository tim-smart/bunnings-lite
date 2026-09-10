import { KeyValueStore, Persistence } from "effect/unstable/persistence"
import { NodeRedis, NodeServices } from "@effect/platform-node"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Config from "effect/Config"

export const PersistenceLayer = Layer.unwrap(
  Effect.gen(function* () {
    const redis = yield* Config.all({
      host: Config.String("REDIS_HOST"),
      port: Config.Port("REDIS_PORT").pipe(Config.withDefault(6379)),
    }).pipe(Config.option)

    if (Option.isSome(redis)) {
      return Persistence.layerRedis.pipe(
        Layer.provide(NodeRedis.layer({ socket: redis.value })),
        Layer.orDie,
      )
    }

    return Persistence.layerKvs.pipe(
      Layer.provide(KeyValueStore.layerFileSystem("data/persistence")),
      Layer.provide(NodeServices.layer),
      Layer.orDie,
    )
  }),
)
