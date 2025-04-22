import { RxRef } from "@effect-rx/rx-react"
import { KeyValueStore } from "@effect/platform"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { ProductBaseInfo } from "../api/src/domain/Bunnings"
import { Effect, Option, Schema } from "effect"

export class Favorites extends Effect.Service<Favorites>()("app/Favorites", {
  dependencies: [BrowserKeyValueStore.layerLocalStorage],
  effect: Effect.gen(function* () {
    const store = (yield* KeyValueStore.KeyValueStore).forSchema(
      Schema.Array(ProductBaseInfo),
    )
    const ref = RxRef.make<ReadonlyArray<ProductBaseInfo>>(
      Option.getOrElse(yield* store.get("favorites"), () => []),
    )

    ref.subscribe((products) => {
      Effect.runFork(store.set("favorites", products))
    })

    return { ref } as const
  }),
}) {}
