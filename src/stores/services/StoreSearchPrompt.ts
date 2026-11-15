import {
  Context,
  Deferred,
  Effect,
  Layer,
  Option,
  Stream,
  SubscriptionRef,
} from "effect"
import type { SessionLocation } from "../../../server/src/domain/Bunnings.ts"

type Answer = Option.Option<SessionLocation>

/**
 * The search of every store, as a question. The store selector asks it and
 * the shell answers it, with the drawer it shows. They are apart because a
 * drawer is a modal: it sits outside the page, which is inert behind it.
 */
export class StoreSearchPrompt extends Context.Service<
  StoreSearchPrompt,
  {
    /** Whether a question is waiting for its answer. */
    readonly asking: Stream.Stream<boolean>
    /**
     * Asks for a store and waits for the answer, which is none when the
     * search is closed without one. The question goes when its asker does,
     * and a second question closes the first.
     */
    readonly ask: Effect.Effect<Answer>
    /** Answers the question that is waiting, if one is. */
    readonly answer: (store: Answer) => Effect.Effect<void>
  }
>()("stores/StoreSearchPrompt") {
  static readonly layer = Layer.effect(
    StoreSearchPrompt,
    Effect.gen(function* () {
      const waiting = yield* SubscriptionRef.make(
        Option.none<Deferred.Deferred<Answer>>(),
      )
      return {
        asking: SubscriptionRef.changes(waiting).pipe(
          Stream.map(Option.isSome),
          Stream.changes,
        ),
        ask: Effect.acquireUseRelease(
          Effect.gen(function* () {
            const question = yield* Deferred.make<Answer>()
            const last = yield* SubscriptionRef.getAndSet(
              waiting,
              Option.some(question),
            )
            if (Option.isSome(last)) {
              yield* Deferred.succeed(last.value, Option.none())
            }
            return question
          }),
          (question) => Deferred.await(question),
          // Only its own: a later question may be waiting by now
          (question) =>
            SubscriptionRef.update(waiting, (current) =>
              Option.isSome(current) && current.value === question
                ? Option.none()
                : current,
            ),
        ),
        answer: (store) =>
          Effect.flatMap(
            SubscriptionRef.get(waiting),
            Option.match({
              onNone: () => Effect.void,
              onSome: (question) => Deferred.succeed(question, store),
            }),
          ),
      }
    }),
  )
}
