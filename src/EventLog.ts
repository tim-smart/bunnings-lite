import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AllEvents } from "./Events"
import { FavoritesLayer } from "./Favorites"
import { kvsRuntime } from "./atoms/kvs"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import * as EventLog from "effect/eventlog/EventLog"
import * as EventLogEncryption from "effect/eventlog/EventLogEncryption"
import * as EventLogRemote from "effect/eventlog/EventLogRemote"
import * as EventJournal from "effect/eventlog/EventJournal"
import * as Atom from "effect/reactivity/Atom"
import * as Context from "effect/Context"
import * as BrowserSocket from "@effect/platform-browser/BrowserSocket"
import * as RpcClient from "effect/rpc/RpcClient"
import * as RpcSerialization from "effect/rpc/RpcSerialization"

export const journalDatabase = "effect_event_journal"

const EventLogLayer = EventLog.layer(AllEvents, FavoritesLayer).pipe(
  Layer.provide(EventJournal.layerIndexedDb({ database: journalDatabase })),
)

const makeClient = EventLog.makeClient(AllEvents)

export class EventLogClient extends Context.Service<EventLogClient>()(
  "EventLogClient",
  {
    make: makeClient,
  },
) {
  static readonly layer = Layer.effect(this, this.make)

  static runtime = Atom.runtime((get) =>
    this.layer.pipe(
      Layer.provideMerge(EventLogLayer),
      Layer.provide(
        Layer.succeed(
          EventLog.Identity,
          get(identityAtom) as EventLog.Identity["Service"],
        ),
      ),
    ),
  )
}

// Storage shared by the atoms and the join, which writes them before the
// atoms exist
export const IdentityStore = {
  key: "identity",
  schema: EventLog.IdentitySchema,
}

export const RemoteUrlStore = {
  key: "remoteUrl",
  schema: Schema.Option(Schema.URL),
}

// Only changes across a reload, in `applyPendingJoin`. Changing it in a
// running page would rebuild `EventLogClient.runtime` on the old journal and
// re-run the last `runtime.fn` mutation under the new identity.
export const identityAtom = Atom.kvs({
  runtime: kvsRuntime,
  ...IdentityStore,
  defaultValue: () =>
    EventLog.makeIdentity.pipe(
      Effect.provide(EventLogEncryption.layerSubtle),
      Effect.runSync,
    ),
})

export const identityStringAtom = Atom.make((get) =>
  EventLog.encodeIdentityString(
    get(identityAtom) as EventLog.Identity["Service"],
  ),
)

export const remoteUrlAtom = Atom.kvs({
  runtime: kvsRuntime,
  ...RemoteUrlStore,
  defaultValue: Option.none,
})

export const EventLogRemoteRuntime = Atom.runtime((get) =>
  Option.match(get(remoteUrlAtom), {
    onNone: () => Layer.empty,
    onSome: (remoteUrl) =>
      EventLogRemote.layerEncrypted.pipe(
        Layer.provide(EventLog.layerRegistry),
        Layer.provide(
          RpcClient.layerProtocolSocket({ retryTransientErrors: true }),
        ),
        Layer.provide(RpcSerialization.layerSchemaBinary()),
        Layer.provide(BrowserSocket.layerWebSocket(remoteUrl.toString())),
      ),
  }),
)
