import { Effect, Layer } from "effect"
import { AuthMiddleware, Unauthorized } from "./domain/Auth"
import { Sessions } from "./Sessions"

export const AuthLayer = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const sessions = yield* Sessions

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
).pipe(Layer.provide(Sessions.Default))
