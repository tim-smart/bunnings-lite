import { Cache, DateTime, Effect, Exit, Layer } from "effect"
import { AuthMiddleware, Unauthorized } from "./domain/Auth"
import { Bunnings } from "./Bunnings"

export const AuthLayer = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const sessions = yield* Cache.makeWith({
      capacity: Number.MAX_SAFE_INTEGER,
      lookup: (_sessionId: string) => bunnings.makeSession,
      timeToLive(exit) {
        if (Exit.isFailure(exit)) {
          return "1 minute"
        }
        return DateTime.subtract(exit.value.expires, { hours: 1 }).pipe(
          DateTime.distanceDuration(DateTime.unsafeNow()),
        )
      },
    })

    return Effect.fnUntraced(function* ({ headers }) {
      const sessionId = headers["session-id"]
      if (!sessionId || sessionId.trim() === "") {
        return yield* new Unauthorized()
      }
      return yield* sessions
        .get(sessionId)
        .pipe(Effect.mapError(() => new Unauthorized()))
    })
  }),
).pipe(Layer.provide(Bunnings.Default))
