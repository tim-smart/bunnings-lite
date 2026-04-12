import { Effect, Layer, pipe } from "effect"
import { AuthMiddleware, Unauthorized } from "./domain/Auth.ts"
import { Sessions } from "./Sessions.ts"
import { CurrentSession } from "./domain/Bunnings.ts"

export const AuthLayer = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const sessions = yield* Sessions

    return AuthMiddleware.of(
      Effect.fn("AuthMiddleware")(function* (effect, { headers }) {
        const sessionId = headers["session-id"]
        if (!sessionId || sessionId.trim() === "") {
          return yield* new Unauthorized()
        }
        const session = yield* pipe(
          sessions.get(sessionId),
          Effect.tapCause(Effect.log),
          Effect.mapError(() => new Unauthorized()),
        )
        return yield* Effect.provideService(effect, CurrentSession, session)
      }),
    )
  }),
).pipe(Layer.provide(Sessions.layer))
