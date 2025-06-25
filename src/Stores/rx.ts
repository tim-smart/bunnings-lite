import { BunningsClient } from "@/RpcClient"
import { Rx } from "@effect-rx/rx-react"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import * as Geolocation from "@effect/platform-browser/Geolocation"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { SessionLocation } from "../../server/src/domain/Bunnings"

const runtime = Rx.runtime(
  Layer.mergeAll(Geolocation.layer, BunningsClient.Default),
)

export const geoRx = runtime.rx(
  Effect.gen(function* () {
    const geo = yield* Geolocation.Geolocation
    return yield* geo.getCurrentPosition()
  }),
)

export const storesRx = runtime
  .rx(
    Effect.fnUntraced(function* (get: Rx.Context) {
      const client = yield* BunningsClient
      const location = yield* get.result(geoRx)
      return client
        .stores({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
        .pipe(Stream.take(10), Stream.accumulate)
    }, Stream.unwrap),
  )
  .pipe(Rx.keepAlive)

export const currentLocationRx = Rx.kvs<Option.Option<SessionLocation>>({
  runtime: Rx.runtime(BrowserKeyValueStore.layerLocalStorage),
  key: "currentLocation",
  schema: Schema.Option(SessionLocation),
  defaultValue: Option.none,
}).pipe(Rx.keepAlive)
