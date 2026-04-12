import { Cache, DateTime, Effect, Exit } from "effect"
import { Bunnings } from "./Bunnings.ts"
import { SessionLocation } from "./domain/Bunnings.ts"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"
import * as Duration from "effect/Duration"

export class Sessions extends Context.Service<Sessions>()("api/Sessions", {
  make: Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const locations = new Map<string, SessionLocation>()

    const sessions = yield* Cache.makeWith(
      (sessionId: string) => bunnings.makeSession(sessionId),
      {
        capacity: Number.MAX_SAFE_INTEGER,
        timeToLive(exit) {
          if (Exit.isFailure(exit)) {
            return Duration.zero
          }
          return DateTime.nowUnsafe().pipe(
            DateTime.distance(
              DateTime.subtract(exit.value.token.expires, { hours: 1 }),
            ),
          )
        },
      },
    )

    return {
      get: Effect.fnUntraced(function* (sessionId: string) {
        const session = yield* Cache.get(sessions, sessionId)
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
    Layer.provide(Bunnings.layer),
  )
}
