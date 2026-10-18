import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { AllEvents } from "./Events"
import { FavoritesLayer, FavoritesRepo } from "./Favorites"
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

const legacyJournalDatabase = "effect_event_journal"

// Journals used to share one database across identities. It now belongs to
// the identity that was active on upgrade, so its unsynced favorites and sync
// progress carry over. A fresh install has no legacy journal.
const legacyJournalIdentity = (() => {
  const key = "legacyJournalIdentity"
  const saved = localStorage.getItem(key)
  if (saved !== null) return saved
  const owner = Schema.decodeUnknownOption(
    Schema.fromJsonString(Schema.Struct({ publicKey: Schema.String })),
  )(localStorage.getItem("identity")).pipe(
    Option.match({ onNone: () => "", onSome: (_) => _.publicKey }),
  )
  localStorage.setItem(key, owner)
  return owner
})()

// Sync progress is tracked per remote server, while the server keeps a
// separate stream per identity, so every identity needs its own journal.
const journalDatabase = (identity: EventLog.Identity["Service"]) =>
  identity.publicKey === legacyJournalIdentity
    ? legacyJournalDatabase
    : `${legacyJournalDatabase}-${identity.publicKey}`

const layerRemote = (remoteUrl: URL) =>
  EventLogRemote.layerEncrypted.pipe(
    Layer.provide(
      RpcClient.layerProtocolSocket({ retryTransientErrors: true }),
    ),
    Layer.provide(RpcSerialization.layerSchemaBinary()),
    Layer.provide(BrowserSocket.layerWebSocket(remoteUrl.toString())),
  )

// Connects in the background, so favorites stay writable while the remote is
// unreachable.
const layerRemoteBackground = (remoteUrl: Option.Option<URL>) =>
  Option.match(remoteUrl, {
    onNone: () => Layer.empty,
    onSome: (url) =>
      Layer.launch(layerRemote(url)).pipe(
        Effect.catchCause(Effect.logError),
        Effect.forkScoped,
        Layer.effectDiscard,
      ),
  })

const makeClient = EventLog.makeClient(AllEvents)

export class EventLogClient extends Context.Service<EventLogClient>()(
  "EventLogClient",
  {
    make: makeClient,
  },
) {
  static readonly layer = Layer.effect(this, this.make)

  static runtime = Atom.runtime((get) => {
    const identity = get(identityAtom) as EventLog.Identity["Service"]
    return Layer.merge(this.layer, layerRemoteBackground(get(remoteUrlAtom))).pipe(
      Layer.provideMerge(EventLog.layer(AllEvents, FavoritesLayer)),
      Layer.provide(
        EventJournal.layerIndexedDb({ database: journalDatabase(identity) }),
      ),
      // Not shared with the log being replaced, which may still be closing
      Layer.fresh,
      Layer.provide(FavoritesRepo.layer),
      Layer.provide(Layer.succeed(EventLog.Identity, identity)),
    )
  })
}

// Runs once against the current log. Unlike `EventLogClient.runtime.fn`, it
// is not re-run when the log is rebuilt for another identity or remote.
export const withEventLog = <A, E, R extends EventLogClient | EventLog.EventLog>(
  get: Atom.FnContext,
  effect: Effect.Effect<A, E, R>,
) =>
  get
    .result(EventLogClient.runtime, { suspendOnWaiting: true })
    .pipe(Effect.flatMap((services) => Effect.provide(effect, services)))

export const identityAtom = Atom.kvs({
  runtime: kvsRuntime,
  key: "identity",
  schema: EventLog.IdentitySchema,
  defaultValue: () =>
    EventLog.makeIdentity.pipe(
      Effect.provide(EventLogEncryption.layerSubtle),
      Effect.runSync,
    ),
})

export const remoteUrlAtom = Atom.kvs({
  runtime: kvsRuntime,
  key: "remoteUrl",
  schema: Schema.Option(Schema.URL),
  defaultValue: Option.none,
})
