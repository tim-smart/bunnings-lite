import { Cache, DateTime, Effect, Exit } from "effect"
import { Bunnings } from "./Bunnings"
import { SessionLocation, Store } from "./domain/Bunnings"

export class Sessions extends Effect.Service<Sessions>()("api/Sessions", {
  dependencies: [Bunnings.Default],
  effect: Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const locations = new Map<string, SessionLocation>()

    const sessions = yield* Cache.makeWith({
      capacity: Number.MAX_SAFE_INTEGER,
      lookup: (sessionId: string) => bunnings.makeSession(sessionId),
      timeToLive(exit) {
        if (Exit.isFailure(exit)) {
          return "1 minute"
        }
        return DateTime.subtract(exit.value.token.expires, { hours: 1 }).pipe(
          DateTime.distanceDuration(DateTime.unsafeNow()),
        )
      },
    })

    return {
      get: Effect.fnUntraced(function* (sessionId: string) {
        const session = yield* sessions.get(sessionId)
        const location = locations.get(sessionId)
        return location ? session.withLocation(location) : session
      }),
      setLocation: (sessionId: string, location: SessionLocation) =>
        Effect.sync(() => {
          locations.set(sessionId, location)
        }),
    } as const
  }),
}) {}
