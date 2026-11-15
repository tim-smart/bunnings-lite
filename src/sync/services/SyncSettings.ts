import { Context, Effect, Layer, Option } from "effect"
import { EventLog, EventLogEncryption } from "effect/eventlog"
import { KeyValueStore } from "effect/persistence"
import { IdentityStore, RemoteUrlStore } from "../domain/Stores.ts"

type Identity = EventLog.Identity["Service"]

/**
 * Who this device is in the event log, and the remote it syncs with.
 *
 * The identity only changes across a reload, when a join is finished.
 * Changing it in a running page would keep writing the old journal under the
 * new identity.
 */
export class SyncSettings extends Context.Service<
  SyncSettings,
  {
    readonly identity: Identity
    readonly remoteUrl: Effect.Effect<Option.Option<URL>>
    readonly setRemoteUrl: (url: Option.Option<URL>) => Effect.Effect<void>
  }
>()("sync/SyncSettings") {
  static readonly layer = Layer.effect(
    SyncSettings,
    Effect.gen(function* () {
      const kvs = yield* KeyValueStore.KeyValueStore
      const identities = KeyValueStore.toSchemaStore(kvs, IdentityStore.schema)
      const remotes = KeyValueStore.toSchemaStore(kvs, RemoteUrlStore.schema)

      // A device makes its identity the first time it needs one, and keeps it
      const saved = yield* identities
        .get(IdentityStore.key)
        .pipe(Effect.orElseSucceed(() => Option.none()))
      const identity = Option.isSome(saved)
        ? (saved.value as Identity)
        : yield* EventLog.makeIdentity.pipe(
            Effect.provide(EventLogEncryption.layerSubtle),
            Effect.tap((identity) =>
              Effect.orDie(identities.set(IdentityStore.key, identity)),
            ),
          )

      return {
        identity,
        remoteUrl: remotes.get(RemoteUrlStore.key).pipe(
          Effect.map(Option.flatten),
          Effect.orElseSucceed(() => Option.none<URL>()),
        ),
        setRemoteUrl: (url) =>
          Effect.orDie(remotes.set(RemoteUrlStore.key, url)),
      }
    }),
  )
}
