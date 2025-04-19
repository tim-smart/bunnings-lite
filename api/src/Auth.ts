import { Effect, Layer } from "effect"
import { AuthMiddleware, Unauthorized } from "./domain/Auth"
import { Session } from "./domain/Bunnings"
import { Bunnings } from "./Bunnings"

export const AuthLayer = Layer.effect(
  AuthMiddleware,
  Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const sessions = new Map<string, Session>()
    const semaphore = yield* Effect.makeSemaphore(1)
    return Effect.fnUntraced(function* ({ headers }) {
      const sessionId = headers["session-id"]
      if (!sessionId || sessionId.trim() === "") {
        return yield* new Unauthorized()
      }
      let session = sessions.get(sessionId)
      if (!session || session.expired) {
        session = yield* Effect.orDie(bunnings.makeSession)
      }
      return session
    }, semaphore.withPermits(1))
  }),
).pipe(Layer.provide(Bunnings.Default))
