import { Identity } from "@effect/experimental/EventLog"
import { Effect, Layer } from "effect"
import { AllEvents } from "./Events"
import { Socket } from "@effect/platform"
import {
  FavoritesCompactionLive,
  FavoritesLayer,
  FavoritesReactivityLive,
} from "./Favorites"
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
)

const CompactionLive = Layer.mergeAll(FavoritesCompactionLive).pipe(
  Layer.provide(EventLogLayer),
)

const ReactivityLayer = Layer.mergeAll(FavoritesReactivityLive).pipe(
  Layer.provide(EventLogLayer),
)

export const EventLogLive = Layer.mergeAll(
  EventLogLayer,
  CompactionLive,
  ReactivityLayer,
).pipe(
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
      Layer.provideMerge(EventLogLive),
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

export const identityStringRx = Rx.make((get) =>
  Identity.toJsonString(get(identityRx)),
)
export const setIdentityRx = EventLogClient.runtime.fn(
  Effect.fnUntraced(function* (s: string, get: Rx.FnContext) {
    const identity = Identity.fromJsonString(s)
    const client = yield* EventLogClient
    yield* client("FavoritesClear", void 0)
    const log = yield* EventLog.EventLog
    yield* log.destroy
    get.set(identityRx, identity)
  }),
)

export const remoteUrlRx = Rx.kvs({
  runtime: kvsRuntime,
  key: "remoteUrl",
  schema: Schema.Option(Schema.URL),
  defaultValue: Option.none,
})
