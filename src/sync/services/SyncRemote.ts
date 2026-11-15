import {
  Context,
  Effect,
  FiberHandle,
  Layer,
  LayerRef,
  Option,
} from "effect"
import { EventLog, EventLogRemote } from "effect/eventlog"
import { RpcClient, RpcSerialization } from "effect/rpc"
import { Socket } from "effect/socket"
import { SyncSettings } from "./SyncSettings.ts"

// The encrypted remote at `url`, attached to the log's registry for as long
// as its Scope is open. It keeps retrying a remote it can't reach.
const remoteLayer = (url: URL) =>
  EventLogRemote.layerEncrypted.pipe(
    Layer.provide(
      RpcClient.layerProtocolSocket({ retryTransientErrors: true }),
    ),
    Layer.provide(RpcSerialization.layerSchemaBinary()),
    Layer.provide(Socket.layerWebSocket(url.toString())),
  )

/**
 * The connection to the sync remote. It connects to the saved remote when it
 * is built, and to a new one whenever the setting changes. The log works
 * without it, so a remote that is down or missing only delays syncing.
 */
export class SyncRemote extends Context.Service<
  SyncRemote,
  {
    /** Saves the remote and connects to it, dropping the one before. */
    readonly setUrl: (url: Option.Option<URL>) => Effect.Effect<void>
  }
>()("sync/SyncRemote") {
  static readonly layer = Layer.effect(
    SyncRemote,
    Effect.gen(function* () {
      const settings = yield* SyncSettings
      const remote = yield* LayerRef.make(
        Layer.unwrap(
          Effect.map(
            settings.remoteUrl,
            Option.match({ onNone: () => Layer.empty, onSome: remoteLayer }),
          ),
        ),
        { idleTimeToLive: "Infinity", preload: false },
      )
      // Connecting waits for the remote to answer, so it runs in the
      // background, and a new remote interrupts a connection still waiting
      const connecting = yield* FiberHandle.make()
      const connect = FiberHandle.run(
        connecting,
        remote.refresh.pipe(
          Effect.catchCause((cause) =>
            Effect.logWarning("Could not connect to the sync remote", cause),
          ),
        ),
      ).pipe(Effect.asVoid)

      yield* connect

      return {
        setUrl: (url) => Effect.andThen(settings.setRemoteUrl(url), connect),
      }
    }),
  ).pipe(Layer.provide([SyncSettings.layer, EventLog.layerRegistry]))
}
