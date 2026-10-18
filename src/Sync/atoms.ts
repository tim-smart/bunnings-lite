import * as EventLog from "effect/eventlog/EventLog"
import * as Option from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import * as Schema from "effect/Schema"
import * as Effect from "effect/Effect"
import * as KeyValueStore from "effect/persistence/KeyValueStore"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import {
  IdentityStore,
  RemoteUrlStore,
  identityAtom,
  journalDatabase,
  remoteUrlAtom,
} from "@/EventLog"
import { FavoritesStore } from "@/Favorites"

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

const pendingJoinKey = "pendingJoin"

// Joining discards this device's journal, sync progress and favorites. A
// running log would keep uploading its journal under the new identity, so the
// switch happens on the next page load, before anything opens the journal.
export const join = (invite: Invite) => {
  localStorage.setItem(pendingJoinKey, Schema.encodeSync(InviteString)(invite))
  location.reload()
}

const deleteJournal = (onBlocked: () => void) =>
  Effect.callback<void, unknown>((resume) => {
    const request = indexedDB.deleteDatabase(journalDatabase)
    request.onblocked = onBlocked
    request.onsuccess = () => resume(Effect.void)
    request.onerror = () => resume(Effect.fail(request.error))
  })

// Safe to re-run, so a join interrupted by closing the page finishes next time
export const applyPendingJoin = (onBlocked: () => void) =>
  Effect.gen(function* () {
    const kvs = yield* KeyValueStore.KeyValueStore
    const encoded = yield* kvs.get(pendingJoinKey)
    if (encoded === undefined) return
    const decoded = Schema.decodeOption(InviteString)(encoded)
    if (Option.isNone(decoded)) return yield* kvs.remove(pendingJoinKey)
    const invite = decoded.value
    yield* deleteJournal(onBlocked)
    yield* kvs.remove(FavoritesStore.key)
    // Awaited store writes rather than the atoms: `Atom.kvs` doesn't report a
    // failed write, so the marker below would be removed anyway
    yield* KeyValueStore.toSchemaStore(kvs, IdentityStore.schema).set(
      IdentityStore.key,
      invite.identity,
    )
    yield* KeyValueStore.toSchemaStore(kvs, RemoteUrlStore.schema).set(
      RemoteUrlStore.key,
      Option.some(invite.remoteUrl),
    )
    yield* kvs.remove(pendingJoinKey)
  }).pipe(Effect.provide(BrowserKeyValueStore.layerLocalStorage))
