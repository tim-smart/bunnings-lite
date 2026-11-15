import { Context, Effect, Layer } from "effect"

/** Reloading the page, which is how the app restarts on a different journal. */
export class Reload extends Context.Service<
  Reload,
  { readonly reload: Effect.Effect<void> }
>()("browser/Reload") {
  static readonly layer = Layer.succeed(Reload, {
    reload: Effect.sync(() => location.reload()),
  })
}
