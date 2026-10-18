import { ProductBaseInfo } from "../server/src/domain/Bunnings"
import * as Schema from "effect/Schema"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FavoriteEvents } from "./Favorites/Events"
import * as Option from "effect/Option"
import * as Array from "effect/Array"
import * as Context from "effect/Context"
import * as Reactivity from "effect/reactivity/Reactivity"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as Atom from "effect/reactivity/Atom"
import * as EventLog from "effect/eventlog/EventLog"

export class FavoritesRepo extends Context.Service<FavoritesRepo>()(
  "FavoritesRepo",
  {
    make: Effect.gen(function* () {
      const reactivity = yield* Reactivity.Reactivity
      const kvs = yield* KeyValueStore.KeyValueStore
      const store = KeyValueStore.toSchemaStore(
        kvs,
        Schema.Array(ProductBaseInfo),
      )
      const addedAtStore = KeyValueStore.toSchemaStore(
        kvs,
        Schema.Record(Schema.String, Schema.Finite),
      )
      const map = (yield* store.get("favorites")).pipe(
        Option.map(
          (products) => new Map(products.map((p) => [p.id, p] as const)),
        ),
        Option.getOrElse(() => new Map<string, ProductBaseInfo>()),
      )
      // When each favorite was last added. Synced events can arrive after
      // newer local ones, e.g. an identity's history after this device's
      // favorites were carried over to it, so a remove or clear only applies
      // to favorites added before it.
      const addedAt = (yield* addedAtStore.get("favoritesAddedAt")).pipe(
        Option.map((record) => new Map(Object.entries(record))),
        Option.getOrElse(() => new Map<string, number>()),
      )
      const addedBefore = (id: string, at: number) =>
        (addedAt.get(id) ?? 0) <= at

      const save = Effect.suspend(() =>
        Effect.all([
          store.set("favorites", Array.fromIterable(map.values())),
          addedAtStore.set("favoritesAddedAt", Object.fromEntries(addedAt)),
        ]),
      ).pipe(
        Effect.orDie,
        Effect.andThen(reactivity.invalidate(["favorites"])),
      )

      const all = Effect.sync(() => Array.reverse(map.values()))
      const allReactive = reactivity.stream(["favorites"], all)
      const add = (product: ProductBaseInfo, at: number) =>
        Effect.suspend(() => {
          map.set(product.id, product)
          // Clamp other devices' clocks, so later local removes always apply
          addedAt.set(
            product.id,
            Math.max(addedAt.get(product.id) ?? 0, Math.min(at, Date.now())),
          )
          return save
        })
      const remove = (id: string, at: number) =>
        Effect.suspend(() => {
          if (!map.has(id) || !addedBefore(id, at)) {
            return Effect.void
          }
          map.delete(id)
          addedAt.delete(id)
          return save
        })
      const clear = (at: number) =>
        Effect.suspend(() => {
          for (const id of map.keys()) {
            if (addedBefore(id, at)) {
              map.delete(id)
              addedAt.delete(id)
            }
          }
          return save
        })
      return { all, allReactive, add, remove, clear } as const
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([BrowserKeyValueStore.layerLocalStorage, Reactivity.layer]),
  )
  static runtime = Atom.runtime(this.layer)
}

const FavoritesEventsLayer = EventLog.group(
  FavoriteEvents,
  Effect.fnUntraced(function* (handlers) {
    const repo = yield* FavoritesRepo

    return handlers
      .handle("FavoriteAdd", ({ payload, entry }) =>
        repo.add(payload, entry.createdAtMillis),
      )
      .handle("FavoriteRemove", ({ payload, entry }) =>
        repo.remove(payload, entry.createdAtMillis),
      )
      .handle("FavoritesClear", ({ entry }) =>
        repo.clear(entry.createdAtMillis),
      )
  }),
)

const FavoritesCompactionLive = EventLog.groupCompaction(
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

export const FavoritesLayer = Layer.mergeAll(
  FavoritesEventsLayer,
  FavoritesCompactionLive,
)
