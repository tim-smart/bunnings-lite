import { Identity } from "@effect/experimental/EventLog"
import { Effect, Layer } from "effect"
import { AllEvents } from "./Events"
import { Socket } from "@effect/platform"
import { FavoritesLayer } from "./Favorites"
import * as EventLog from "@effect/experimental/EventLog"
import * as EventJournal from "@effect/experimental/EventJournal"
import * as EventLogEncryption from "@effect/experimental/EventLogEncryption"
import { Rx } from "@effect-rx/rx-react"
import * as EventLogRemote from "@effect/experimental/EventLogRemote"
import { kvsRuntime } from "./rx/kvs"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import * as Function from "effect/Function"

const EventLogLayer = EventLog.layer(AllEvents).pipe(
  Layer.provide([FavoritesLayer]),
  Layer.provide(EventJournal.layerIndexedDb()),
  Layer.provide([
    EventLogEncryption.layerSubtle,
    Socket.layerWebSocketConstructorGlobal,
  ]),
)

const makeClient = EventLog.makeClient(AllEvents)

export class EventLogClient extends Effect.Service<EventLogClient>()(
  "EventLogClient",
  {
    effect: makeClient,
  },
) {
  static runtime = Rx.runtime((get) => {
    const remoteUrl = get(remoteUrlRx)
    return this.Default.pipe(
      Option.isSome(remoteUrl)
        ? Layer.provide(
            EventLogRemote.layerWebSocketBrowser(remoteUrl.value.toString()),
          )
        : Function.identity,
      Layer.provideMerge(EventLogLayer),
      Layer.provide(Layer.succeed(Identity, get(identityRx))),
    )
  })
}

export const identityRx = Rx.kvs({
  runtime: kvsRuntime,
  key: "identity",
  schema: Identity.Schema,
  defaultValue: Identity.makeRandom,
})

export const identityStringRx = Rx.writable(
  (get) => Identity.encodeString(get(identityRx)),
  (ctx, s: string) => ctx.set(identityRx, Identity.decodeString(s)),
)

export const remoteUrlRx = Rx.kvs({
  runtime: kvsRuntime,
  key: "remoteUrl",
  schema: Schema.Option(Schema.URL),
  defaultValue: Option.none,
})
