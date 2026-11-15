import { Context, Effect, Layer, Option, Schema, Stream } from "effect"
import { EventLog } from "effect/eventlog"
import { Reload } from "../../browser/services/Reload.ts"
import { UrlFragment } from "../../browser/services/UrlFragment.ts"
import {
  type Invite,
  InviteString,
  type PendingInvite,
} from "../domain/Invite.ts"
import { PendingJoin } from "./PendingJoin.ts"
import { SyncSettings } from "./SyncSettings.ts"

/**
 * Invite links: making one for this device, and joining through one that was
 * opened. An invite carries a private key, so an opened one is kept here and
 * the interface only learns which remote it points at.
 */
export class Invites extends Context.Service<
  Invites,
  {
    /** The link that invites another device, when a remote is set. */
    readonly link: Effect.Effect<Option.Option<string>>
    /** Each invite link the page is opened with. */
    readonly opened: Stream.Stream<PendingInvite>
    /**
     * Joins through the last valid invite that was opened: records the join
     * and reloads the page, which applies it.
     */
    readonly join: Effect.Effect<void>
  }
>()("sync/Invites") {
  static readonly layer = Layer.effect(
    Invites,
    Effect.gen(function* () {
      const fragment = yield* UrlFragment
      const settings = yield* SyncSettings
      const pendingJoin = yield* PendingJoin
      const page = yield* Reload
      let last: Invite | undefined

      return {
        link: Effect.map(
          settings.remoteUrl,
          Option.map((remoteUrl) => {
            const encoded = Schema.encodeSync(InviteString)({
              remoteUrl,
              identity:
                settings.identity as typeof EventLog.IdentitySchema.Type,
            })
            return `${location.origin}/#invite=${encoded}`
          }),
        ),
        opened: fragment.values("invite").pipe(
          Stream.map((encoded): PendingInvite =>
            Option.match(Schema.decodeOption(InviteString)(encoded), {
              onNone: () => ({ _tag: "Invalid" }),
              onSome: (invite) => {
                last = invite
                return { _tag: "Valid", host: invite.remoteUrl.host }
              },
            }),
          ),
        ),
        join: Effect.suspend(() =>
          last === undefined
            ? Effect.void
            : Effect.andThen(pendingJoin.request(last), page.reload),
        ),
      }
    }),
  ).pipe(Layer.provide([SyncSettings.layer, PendingJoin.layer]))
}
