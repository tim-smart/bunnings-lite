import { Context, Effect, Layer } from "effect"

/** The device's share sheet. */
export class Share extends Context.Service<
  Share,
  {
    /** Offers the page that is showing. Does nothing where sharing is unsupported. */
    readonly sharePage: (title: string) => Effect.Effect<void>
  }
>()("browser/Share") {
  static readonly layer = Layer.succeed(Share, {
    sharePage: (title) =>
      Effect.suspend(() =>
        typeof navigator.share !== "function"
          ? Effect.void
          : // Dismissing the sheet rejects, which is not a failure
            Effect.promise(() =>
              navigator.share({ title, url: location.href }),
            ).pipe(Effect.ignoreCause),
      ),
  })
}
