import { Context, Effect, Layer, Stream, SubscriptionRef } from "effect"

interface BeforeInstallPromptEvent extends Event {
  readonly prompt: () => Promise<unknown>
  readonly userChoice: Promise<unknown>
}

/** The browser's offer to install the app on the home screen. */
export class InstallPrompt extends Context.Service<
  InstallPrompt,
  {
    /** Whether the browser is offering an install right now. */
    readonly available: Stream.Stream<boolean>
    /** Shows the browser's install dialog and waits for the answer. */
    readonly prompt: Effect.Effect<void>
  }
>()("browser/InstallPrompt") {
  static readonly layer = Layer.effect(
    InstallPrompt,
    Effect.gen(function* () {
      const offer = yield* SubscriptionRef.make<
        BeforeInstallPromptEvent | undefined
      >(undefined)
      const onOffer = (event: Event) => {
        event.preventDefault()
        // @effect-diagnostics-next-line runEffectInsideEffect:off
        Effect.runSync(
          SubscriptionRef.set(offer, event as BeforeInstallPromptEvent),
        )
      }
      yield* Effect.addFinalizer(() =>
        Effect.sync(() =>
          window.removeEventListener("beforeinstallprompt", onOffer),
        ),
      )
      window.addEventListener("beforeinstallprompt", onOffer)
      return {
        available: SubscriptionRef.changes(offer).pipe(
          Stream.map((event) => event !== undefined),
          Stream.changes,
        ),
        prompt: Effect.gen(function* () {
          const event = yield* SubscriptionRef.get(offer)
          if (event === undefined) return
          // An offer can be used once
          yield* SubscriptionRef.set(offer, undefined)
          yield* Effect.promise(() =>
            event.prompt().then(() => event.userChoice),
          ).pipe(Effect.ignoreCause)
        }),
      }
    }),
  )
}
