import { Atom } from "@effect-atom/atom-react"
import { ProductBaseInfo } from "../server/src/domain/Bunnings"
import * as Schema from "effect/Schema"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import { EventLog } from "@effect/experimental"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { FavoriteEvents } from "./Favorites/Events"
import * as KeyValueStore from "@effect/platform/KeyValueStore"
import * as Option from "effect/Option"
import * as Reactivity from "@effect/experimental/Reactivity"
import * as Array from "effect/Array"

export class FavoritesRepo extends Effect.Service<FavoritesRepo>()(
  "FavoritesRepo",
  {
    dependencies: [BrowserKeyValueStore.layerLocalStorage, Reactivity.layer],
    effect: Effect.gen(function* () {
      const reactivity = yield* Reactivity.Reactivity
      const store = (yield* KeyValueStore.KeyValueStore).forSchema(
        Schema.Array(ProductBaseInfo),
      )
      const map = (yield* store.get("favorites")).pipe(
        Option.map(
          (products) => new Map(products.map((p) => [p.id, p] as const)),
        ),
        Option.getOrElse(() => new Map<string, ProductBaseInfo>()),
      )

      const all = Effect.sync(() => Array.reverse(map.values()))
      const allReactive = reactivity.stream(["favorites"], all)
      const add = (product: ProductBaseInfo) =>
        Effect.suspend(() => {
          map.set(product.id, product)
          return store
            .set("favorites", Array.fromIterable(map.values()))
            .pipe(Effect.orDie)
        })
      const remove = (id: string) =>
        Effect.suspend(() => {
          if (!map.has(id)) {
            return Effect.void
          }
          map.delete(id)
          return store
            .set("favorites", Array.fromIterable(map.values()))
            .pipe(Effect.orDie)
        })
      const clear = Effect.suspend(() => {
        map.clear()
        return store.set("favorites", []).pipe(Effect.orDie)
      })
      return { all, allReactive, add, remove, clear } as const
    }),
  },
) {
  static runtime = Atom.runtime(this.Default)
}

const FavoritesEventsLayer = EventLog.group(
  FavoriteEvents,
  Effect.fnUntraced(function* (handlers) {
    const repo = yield* FavoritesRepo

    return handlers
      .handle("FavoriteAdd", ({ payload }) => repo.add(payload))
      .handle("FavoriteRemove", ({ payload }) => repo.remove(payload))
      .handle("FavoritesClear", () => repo.clear)
  }),
).pipe(Layer.provide(FavoritesRepo.Default))

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

const FavoritesReactivityLive = EventLog.groupReactivity(FavoriteEvents, [
  "favorites",
])

export const FavoritesLayer = Layer.mergeAll(
  FavoritesEventsLayer,
  FavoritesCompactionLive,
  FavoritesReactivityLive,
)
