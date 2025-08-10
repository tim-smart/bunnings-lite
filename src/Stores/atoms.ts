import { BunningsClient } from "@/RpcClient"
import { Atom } from "@effect-atom/atom-react"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import * as Geolocation from "@effect/platform-browser/Geolocation"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { SessionLocation } from "../../server/src/domain/Bunnings"
import * as Layer from "effect/Layer"

const runtime = Atom.runtime(
  Geolocation.layer.pipe(Layer.merge(BunningsClient.layer)),
)

export const geoAtom = runtime.atom(
  Effect.gen(function* () {
    const geo = yield* Geolocation.Geolocation
    return yield* geo.getCurrentPosition()
  }),
)

export const storesAtom = runtime
  .atom(
    Effect.fnUntraced(function* (get) {
      const client = yield* BunningsClient
      const location = yield* get.result(geoAtom)
      return client("stores", {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      }).pipe(Stream.take(10), Stream.accumulate)
    }, Stream.unwrap),
  )
  .pipe(Atom.keepAlive)

export const currentLocationAtom = Atom.kvs<Option.Option<SessionLocation>>({
  runtime: Atom.runtime(BrowserKeyValueStore.layerLocalStorage),
  key: "currentLocation",
  schema: Schema.Option(SessionLocation),
  defaultValue: Option.none,
}).pipe(Atom.keepAlive)
