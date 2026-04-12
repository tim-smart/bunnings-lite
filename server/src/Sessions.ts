import { DateTime, Effect, Exit } from "effect"
import { Bunnings } from "./Bunnings.ts"
import { Session, SessionLocation } from "./domain/Bunnings.ts"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"
import * as Persistable from "effect/unstable/persistence/Persistable"
import * as PersistedCache from "effect/unstable/persistence/PersistedCache"
import { PersistenceLayer } from "./Persistence.ts"

export class Sessions extends Context.Service<Sessions>()("api/Sessions", {
  make: Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const locations = new Map<string, SessionLocation>()

    const ttl = (exit: Exit.Exit<Session>) => {
      if (Exit.isFailure(exit)) {
        return Duration.zero
      }
      return DateTime.nowUnsafe().pipe(
        DateTime.distance(
          DateTime.subtract(exit.value.token.expires, { hours: 1 }),
        ),
      )
    }

    const sessions = yield* PersistedCache.make(
      ({ sessionId }: SessionLookup) =>
        bunnings.makeSession(sessionId).pipe(Effect.orDie),
      {
        storeId: "sessions",
        inMemoryTTL: ttl,
        timeToLive: ttl,
      },
    )

    return {
      get: Effect.fnUntraced(function* (sessionId: string) {
        const session = yield* sessions.get(new SessionLookup({ sessionId }))
        const location = locations.get(sessionId)
        return location ? session.withLocation(location) : session
      }),
      setLocation: (sessionId: string, location: SessionLocation) =>
        Effect.sync(() => {
          locations.set(sessionId, location)
        }),
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(PersistenceLayer),
    Layer.provide(Bunnings.layer),
  )
}

class SessionLookup extends Persistable.Class<{
  payload: {
    sessionId: string
  }
}>()("SessionLookup", {
  primaryKey: (_) => _.sessionId,
  success: Session,
}) {}
