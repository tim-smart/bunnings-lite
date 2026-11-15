import { Context, Effect, Layer, Option, Queue, Schema, Stream } from "effect"
import { KeyValueStore } from "effect/persistence"
import { FavoritesStore } from "../../favorites/domain/Favorites.ts"
import {
  type Invite,
  InviteString,
  JoinFailed,
  type JoinProgress,
} from "../domain/Invite.ts"
import {
  IdentityStore,
  journalDatabase,
  pendingJoinKey,
  RemoteUrlStore,
} from "../domain/Stores.ts"

const deleteJournal = (onBlocked: () => void) =>
  Effect.callback<void, unknown>((resume) => {
    const request = indexedDB.deleteDatabase(journalDatabase)
    request.onblocked = onBlocked
    request.onsuccess = () => resume(Effect.void)
    request.onerror = () => resume(Effect.fail(request.error))
  })

/**
 * Joining another device's sync. It discards this device's journal, sync
 * progress and favourites, and a running log would keep uploading its
 * journal under the new identity. So a join is only recorded here, and it is
 * applied on the next page load, before anything opens the journal.
 */
export class PendingJoin extends Context.Service<
  PendingJoin,
  {
    /** Records the join. The caller reloads the page to apply it. */
    readonly request: (invite: Invite) => Effect.Effect<void>
    /**
     * Applies a recorded join, if there is one. Emits `Blocked` while other
     * tabs keep the journal open, then `Finished`. Safe to run again, so a
     * join interrupted by closing the page finishes next time.
     */
    readonly finish: Stream.Stream<JoinProgress, JoinFailed>
  }
>()("sync/PendingJoin") {
  static readonly layer = Layer.effect(
    PendingJoin,
    Effect.gen(function* () {
      const kvs = yield* KeyValueStore.KeyValueStore

      const apply = (onBlocked: () => void) =>
        Effect.gen(function* () {
          const encoded = yield* kvs.get(pendingJoinKey)
          if (encoded === undefined) return
          const decoded = Schema.decodeOption(InviteString)(encoded)
          if (Option.isNone(decoded)) return yield* kvs.remove(pendingJoinKey)
          const invite = decoded.value
          yield* deleteJournal(onBlocked)
          yield* kvs.remove(FavoritesStore.key)
          yield* KeyValueStore.toSchemaStore(kvs, IdentityStore.schema).set(
            IdentityStore.key,
            invite.identity,
          )
          yield* KeyValueStore.toSchemaStore(kvs, RemoteUrlStore.schema).set(
            RemoteUrlStore.key,
            Option.some(invite.remoteUrl),
          )
          // Last, so a join that failed part way is tried again in full
          yield* kvs.remove(pendingJoinKey)
        }).pipe(Effect.mapError(() => new JoinFailed()))

      return {
        request: (invite) =>
          Effect.orDie(
            kvs.set(pendingJoinKey, Schema.encodeSync(InviteString)(invite)),
          ),
        finish: Stream.unwrap(
          Effect.gen(function* () {
            const blocked = yield* Queue.unbounded<JoinProgress>()
            const applied = apply(() => {
              Queue.offerUnsafe(blocked, "Blocked")
            })
            return Stream.merge(
              Stream.fromQueue(blocked),
              Stream.fromEffect(Effect.as(applied, "Finished" as const)),
            ).pipe(Stream.takeUntil((progress) => progress === "Finished"))
          }),
        ),
      }
    }),
  )
}
