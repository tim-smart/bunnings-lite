import * as Option from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as Array from "effect/Array"
import * as EventLog from "effect/eventlog/EventLog"
import { identityAtom, remoteUrlAtom, withEventLog } from "@/EventLog"
import { AllEvents } from "@/Events"
import { favoritesAtom } from "@/Favorites/atoms"

const RemoteUrl = Schema.URLFromString.check(
  Schema.makeFilter(
    (url) =>
      url.protocol === "ws:" ||
      url.protocol === "wss:" ||
      "Expected a ws: or wss: URL",
  ),
)

const Invite = Schema.Struct({
  remoteUrl: RemoteUrl,
  identity: EventLog.IdentitySchema,
})
export type Invite = typeof Invite.Type

const InviteString = Schema.StringFromBase64Url.pipe(
  Schema.decodeTo(Schema.fromJsonString(Invite)),
)

export type PendingInvite =
  | { readonly _tag: "Valid"; readonly invite: Invite }
  | { readonly _tag: "Invalid" }

// The invite carries the identity's private key, so it only ever lives in the
// URL fragment (never sent to a server) and is removed from the address bar
// as soon as it has been read.
const takeInviteFromLocation = (): Option.Option<PendingInvite> => {
  const encoded = new URLSearchParams(location.hash.slice(1)).get("invite")
  if (encoded === null) return Option.none()
  history.replaceState(history.state, "", location.pathname + location.search)
  return Option.some(
    Option.match(Schema.decodeOption(InviteString)(encoded), {
      onNone: () => ({ _tag: "Invalid" }),
      onSome: (invite) => ({ _tag: "Valid", invite }),
    }),
  )
}

// Read at module load so the fragment is gone before the router reads the URL
const initialInvite = takeInviteFromLocation()

export const pendingInviteAtom = Atom.writable(
  (get): Option.Option<PendingInvite> => {
    // An installed PWA reuses the open window for a new invite link, which
    // only changes the fragment.
    const onHashChange = () => {
      const invite = takeInviteFromLocation()
      if (Option.isSome(invite)) get.setSelf(invite)
    }
    window.addEventListener("hashchange", onHashChange)
    get.addFinalizer(() =>
      window.removeEventListener("hashchange", onHashChange),
    )
    // The fragment may have changed between module load and first read
    return Option.orElse(takeInviteFromLocation(), () => initialInvite)
  },
  (ctx, value: Option.Option<PendingInvite>) => ctx.setSelf(value),
).pipe(Atom.keepAlive)

export const inviteLinkAtom = Atom.make((get) =>
  Option.map(get(remoteUrlAtom), (remoteUrl) => {
    const encoded = Schema.encodeSync(InviteString)({
      remoteUrl,
      identity: get(identityAtom),
    })
    return `${location.origin}/#invite=${encoded}`
  }),
)

// Each identity has its own journal, so the favorites on this device are
// written to the new identity's log to carry them over and sync them there.
// Kept alive so it finishes after the join prompt unmounts.
export const switchIdentityAtom = Atom.fn(
  Effect.fnUntraced(function* (
    identity: typeof EventLog.IdentitySchema.Type,
    get: Atom.FnContext,
  ) {
    if (get(identityAtom).publicKey === identity.publicKey) return
    // Oldest first, so other devices list them in the same order
    const favorites = Array.reverse(yield* get.result(favoritesAtom))
    get.set(identityAtom, identity)
    if (!Array.isReadonlyArrayNonEmpty(favorites)) return
    yield* withEventLog(
      get,
      EventLog.EventLog.use((log) =>
        log.writeMany({
          schema: AllEvents,
          events: Array.map(favorites, (product) => ({
            event: "FavoriteAdd" as const,
            payload: product,
          })),
        }),
      ),
    )
  }),
).pipe(Atom.keepAlive)

export const identityStringAtom = Atom.make((get) =>
  EventLog.encodeIdentityString(
    get(identityAtom) as EventLog.Identity["Service"],
  ),
)
