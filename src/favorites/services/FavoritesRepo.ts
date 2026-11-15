import { Context, Effect, Layer, Option, PubSub, Stream } from "effect"
import { KeyValueStore } from "effect/persistence"
import type { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { FavoritesStore } from "../domain/Favorites.ts"

/**
 * The favourites as the event log's handlers leave them: a list in the key
 * value store, so it is there before the journal has replayed.
 */
export class FavoritesRepo extends Context.Service<
  FavoritesRepo,
  {
    /** Newest first. */
    readonly all: Effect.Effect<ReadonlyArray<ProductBaseInfo>>
    /** Emits after each change, whichever device made it. */
    readonly changes: Stream.Stream<void>
    readonly add: (product: ProductBaseInfo) => Effect.Effect<void>
    readonly remove: (id: string) => Effect.Effect<void>
    readonly clear: Effect.Effect<void>
  }
>()("favorites/FavoritesRepo") {
  static readonly layer = Layer.effect(
    FavoritesRepo,
    Effect.gen(function* () {
      const store = KeyValueStore.toSchemaStore(
        yield* KeyValueStore.KeyValueStore,
        FavoritesStore.schema,
      )
      const changed = yield* PubSub.unbounded<void>()
      const saved = yield* store
        .get(FavoritesStore.key)
        .pipe(Effect.orElseSucceed(() => Option.none()))
      const map = new Map(
        Option.getOrElse(saved, () => []).map((p) => [p.id, p] as const),
      )
      const save = Effect.suspend(() =>
        store.set(FavoritesStore.key, Array.from(map.values())),
      ).pipe(Effect.orDie, Effect.andThen(PubSub.publish(changed, undefined)))

      return {
        all: Effect.sync(() => Array.from(map.values()).reverse()),
        changes: Stream.fromPubSub(changed),
        add: (product) =>
          Effect.suspend(() => {
            map.set(product.id, product)
            return save
          }),
        remove: (id) =>
          Effect.suspend(() => (map.delete(id) ? save : Effect.void)),
        clear: Effect.suspend(() => {
          map.clear()
          return save
        }),
      }
    }),
  )
}
