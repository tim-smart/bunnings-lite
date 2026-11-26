import { Effect, Option, Schema } from "effect"
import { EventLog } from "effect/eventlog"
import { Query } from "@effect/ui"
import { SyncSettings } from "../services/SyncSettings.ts"

/** The device's identity, and the remote it syncs with if one is set. */
export class GetSyncSettings extends Query.Service<GetSyncSettings>()(
  "sync/GetSyncSettings",
  {
    args: {},
    success: Schema.Struct({
      /** The identity as the text an invite carries. It holds a private key. */
      identity: Schema.String,
      remoteUrl: Schema.NullOr(Schema.String),
    }),
    error: Schema.Never,
    staleTime: "1 hour",
  },
) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const settings = yield* SyncSettings
      const identity = EventLog.encodeIdentityString(settings.identity)
      return () =>
        Effect.map(settings.remoteUrl, (url) => ({
          identity,
          remoteUrl: Option.match(url, {
            onNone: () => null,
            onSome: (url) => url.toString(),
          }),
        }))
    }),
  )
}
