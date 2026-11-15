import { Context, Effect, Layer, Stream } from "effect"
import { EventJournal, EventLog } from "effect/eventlog"
import type { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { journalDatabase } from "../../sync/domain/Stores.ts"
import { SyncSettings } from "../../sync/services/SyncSettings.ts"
import { FavoriteEvents } from "../domain/Events.ts"
import { AllEvents } from "../domain/Favorites.ts"
import { FavoritesRepo } from "./FavoritesRepo.ts"

// How the log's events change the stored list. Events arrive here whether
// this device wrote them or a remote did.
const Handlers = EventLog.group(
  FavoriteEvents,
  Effect.fnUntraced(function* (handlers) {
    const repo = yield* FavoritesRepo
    return handlers
      .handle("FavoriteAdd", ({ payload }) => repo.add(payload))
      .handle("FavoriteRemove", ({ payload }) => repo.remove(payload))
      .handle("FavoritesClear", () => repo.clear)
  }),
)

// What a remote keeps of a run of events: the favourites they leave
const Compaction = EventLog.groupCompaction(
  FavoriteEvents,
  Effect.fnUntraced(function* ({ events, write }) {
    const map = new Map<string, ProductBaseInfo>()
    const removes = new Set<string>()
    let clear = false
    for (const event of events) {
      switch (event._tag) {
        case "FavoriteAdd": {
          map.set(event.payload.id, event.payload)
          break
        }
        case "FavoriteRemove": {
          if (map.has(event.payload)) {
            map.delete(event.payload)
          } else if (!clear) {
            removes.add(event.payload)
          }
          break
        }
        case "FavoritesClear": {
          map.clear()
          removes.clear()
          clear = true
          break
        }
      }
    }
    if (clear) {
      yield* write("FavoritesClear", undefined)
    }
    for (const product of map.values()) {
      yield* write("FavoriteAdd", product)
    }
    for (const id of removes) {
      yield* write("FavoriteRemove", id)
    }
  }),
)

const IdentityLayer = Layer.effect(
  EventLog.Identity,
  Effect.map(SyncSettings, (settings) => settings.identity),
).pipe(Layer.provide(SyncSettings.layer))

/**
 * The device's event log, holding its favourites in an IndexedDB journal
 * under its identity. A sync remote attaches to its registry.
 */
export const EventLogLayer = EventLog.layer(
  AllEvents,
  Layer.mergeAll(Handlers, Compaction),
).pipe(
  Layer.provide([
    EventJournal.layerIndexedDb({ database: journalDatabase }),
    IdentityLayer,
    FavoritesRepo.layer,
    EventLog.layerRegistry,
  ]),
  // Without its journal the device can't keep favourites at all, and there
  // is nothing to fall back to
  Layer.orDie,
)

/**
 * The favourites. A change is written to the event log, so it stays on this
 * device when no remote can be reached and reaches the others when one can.
 */
export class Favorites extends Context.Service<
  Favorites,
  {
    /** Newest first. */
    readonly all: Effect.Effect<ReadonlyArray<ProductBaseInfo>>
    /** Emits after each change, whichever device made it. */
    readonly changes: Stream.Stream<void>
    /** Adds the product, or removes it if it is already a favourite. */
    readonly toggle: (product: ProductBaseInfo) => Effect.Effect<void>
    readonly clear: Effect.Effect<void>
  }
>()("favorites/Favorites") {
  static readonly layer = Layer.effect(
    Favorites,
    Effect.gen(function* () {
      const repo = yield* FavoritesRepo
      const write = yield* EventLog.makeClient(AllEvents)
      return {
        all: repo.all,
        changes: repo.changes,
        toggle: (product) =>
          Effect.flatMap(repo.all, (favorites) =>
            favorites.some((favorite) => favorite.id === product.id)
              ? write({ event: "FavoriteRemove", payload: product.id })
              : write({ event: "FavoriteAdd", payload: product }),
          ).pipe(Effect.orDie),
        clear: Effect.orDie(
          write({ event: "FavoritesClear", payload: undefined }),
        ),
      }
    }),
  ).pipe(Layer.provide([EventLogLayer, FavoritesRepo.layer]))
}
