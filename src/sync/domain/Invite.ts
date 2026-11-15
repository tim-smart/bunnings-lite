import { Schema } from "effect"
import { EventLog } from "effect/eventlog"

export const RemoteUrl = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      url.protocol === "ws:" ||
      url.protocol === "wss:" ||
      "Expected a ws: or wss: URL",
  ),
)

/** Everything another device needs to share this one's favourites. */
export const Invite = Schema.Struct({
  remoteUrl: RemoteUrl,
  identity: EventLog.IdentitySchema,
})
export type Invite = typeof Invite.Type

/** An invite as it travels in a link. */
export const InviteString = Schema.StringFromBase64Url.pipe(
  Schema.decodeTo(Schema.fromJsonString(Invite)),
)

/**
 * An invite link that was opened, as the interface sees it. The invite
 * itself carries a private key, so it stays in the `Invites` service and
 * never enters a Model.
 */
export const PendingInvite = Schema.TaggedUnion({
  Valid: { host: Schema.String },
  Invalid: {},
})
export type PendingInvite = typeof PendingInvite.Type

/** Finishing a join failed. Reloading tries the whole join again. */
export class JoinFailed extends Schema.TaggedError<JoinFailed>()(
  "JoinFailed",
  {},
) {}

export const JoinProgress = Schema.Literals(["Blocked", "Finished"])
export type JoinProgress = typeof JoinProgress.Type
