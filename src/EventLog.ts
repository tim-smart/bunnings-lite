import { Effect, Layer } from "effect"
import { AllEvents } from "./Events"
import { FavoritesLayer } from "./Favorites"
import { kvsRuntime } from "./atoms/kvs"
import * as Schema from "effect/Schema"
import * as Option from "effect/Option"
import * as Function from "effect/Function"
import * as EventLog from "effect/unstable/eventlog/EventLog"
import * as EventLogEncryption from "effect/unstable/eventlog/EventLogEncryption"
import * as EventLogRemote from "effect/unstable/eventlog/EventLogRemote"
import * as EventJournal from "effect/unstable/eventlog/EventJournal"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as Context from "effect/Context"
import * as BrowserSocket from "@effect/platform-browser/BrowserSocket"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"

const EventLogLayer = EventLog.layer(AllEvents, FavoritesLayer).pipe(
  Layer.provide(EventJournal.layerIndexedDb()),
)

const makeClient = EventLog.makeClient(AllEvents)

export class EventLogClient extends Context.Service<EventLogClient>()(
  "EventLogClient",
  {
    make: makeClient,
  },
) {
  static readonly layer = Layer.effect(this, this.make)

  static runtime = Atom.runtime((get) => {
    const remoteUrl = get(remoteUrlAtom)
    return this.layer.pipe(
      Option.isSome(remoteUrl)
        ? Layer.provide(
            EventLogRemote.layerEncrypted.pipe(
              Layer.provide(EventLog.layerRegistry),
              Layer.provide(
                RpcClient.layerProtocolSocket({ retryTransientErrors: true }),
              ),
              Layer.provide(RpcSerialization.layerMsgPack),
              Layer.provide(
                BrowserSocket.layerWebSocket(remoteUrl.value.toString()),
              ),
            ),
          )
        : Function.identity,
      Layer.provideMerge(EventLogLayer),
      Layer.provide(
        Layer.succeed(
          EventLog.Identity,
          get(identityAtom) as EventLog.Identity["Service"],
        ),
      ),
    )
  })
}

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

const IdentityString = Schema.StringFromBase64.pipe(
  Schema.decodeTo(Schema.fromJsonString(EventLog.IdentitySchema)),
)
const encodeIdentityString = Schema.encodeSync(IdentityString)
const decodeIdentityString = Schema.decodeSync(IdentityString)

export const identityStringAtom = Atom.writable(
  (get) =>
    encodeIdentityString(get(identityAtom) as EventLog.Identity["Service"]),
  (ctx, s: string) => ctx.set(identityAtom, decodeIdentityString(s)),
)

export const remoteUrlAtom = Atom.kvs({
  runtime: kvsRuntime,
  key: "remoteUrl",
  schema: Schema.Option(Schema.URL),
  defaultValue: Option.none,
})
