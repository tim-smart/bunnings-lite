import { SessionLocation } from "../../api/src/domain/Bunnings"
import { Effect, Layer, Option, Schema, Stream } from "effect"
import { Rx } from "@effect-rx/rx-react"
import { BrowserKeyValueStore, Geolocation } from "@effect/platform-browser"
import { BunningsClient } from "@/RpcClient"

const runtime = Rx.runtime(
  Layer.mergeAll(Geolocation.layer, BunningsClient.Default),
)

export const geoRx = runtime.rx(
  Effect.fnUntraced(function* (_get: Rx.Context) {
    const geo = yield* Geolocation.Geolocation
    return yield* geo.getCurrentPosition()
  }),
)

export const storesRx = runtime
  .rx((get) =>
    Effect.gen(function* () {
      const client = yield* BunningsClient
      const location = yield* get.result(geoRx)
      return client
        .stores({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
        .pipe(Stream.take(10), Stream.accumulate)
    }).pipe(Stream.unwrap),
  )
  .pipe(Rx.keepAlive)

export const currentLocationRx = Rx.kvs<Option.Option<SessionLocation>>({
  runtime: Rx.runtime(BrowserKeyValueStore.layerLocalStorage),
  key: "currentLocation",
  schema: Schema.Option(SessionLocation),
  defaultValue: Option.none,
}).pipe(Rx.keepAlive)
