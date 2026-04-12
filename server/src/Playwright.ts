/**
 * @since 1.0.0
 */
import { Config, Context, Data, Effect, Layer } from "effect"
import * as Api from "playwright"

export class PlaywrightError extends Data.TaggedError("PlaywrightError")<{
  readonly cause: unknown
}> {}

export class Browser extends Context.Service<Browser, Api.Browser>()(
  "Playwright/Browser",
) {
  static readonly layerChromium = (options?: Api.LaunchOptions) =>
    Layer.effect(
      this,
      Effect.acquireRelease(
        Effect.tryPromise({
          try: () => Api.chromium.launch(options),
          catch: (cause) => new PlaywrightError({ cause }),
        }),
        (browser) => Effect.promise(() => browser.close()),
      ),
    )

  static readonly layerWebkit = (options?: Api.LaunchOptions) =>
    Layer.effect(
      this,
      Effect.acquireRelease(
        Effect.tryPromise({
          try: () => Api.webkit.launch(options),
          catch: (cause) => new PlaywrightError({ cause }),
        }),
        (browser) => Effect.promise(() => browser.close()),
      ),
    )

  static Live = Layer.unwrap(
    Effect.gen({ self: this }, function* () {
      const isProd = yield* Config.string("NODE_ENV").pipe(
        Config.map((env) => env === "production"),
        Config.withDefault(false),
      )

      return this.layerChromium({
        headless: isProd,
        args: isProd ? ["--no-sandbox"] : [],
      })
    }),
  )
}

export class BrowserContext extends Context.Service<
  BrowserContext,
  Api.BrowserContext
>()("Playwright/BrowserContext") {
  static layerWith = (options?: Api.BrowserContextOptions) =>
    Layer.effect(
      this,
      Browser.use((browser) =>
        Effect.acquireRelease(
          Effect.tryPromise({
            try: () => browser.newContext(options),
            catch: (cause) => new PlaywrightError({ cause }),
          }),
          (context) => Effect.promise(() => context.close()),
        ),
      ),
    )

  static layer = this.layerWith().pipe(Layer.provide(Browser.Live))
}

export class Page extends Context.Service<Page>()("Playwright/Page", {
  make: Effect.gen(function* () {
    const context = yield* BrowserContext
    const page = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => context.newPage(),
        catch: (cause) => new PlaywrightError({ cause }),
      }),
      (page) => Effect.promise(() => page.close()),
    )

    return {
      page,
      with<A>(
        f: (page: Api.Page) => Promise<A>,
      ): Effect.Effect<A, PlaywrightError> {
        const trace = new Error()
        return Effect.tryPromise({
          try: () => f(page),
          catch: (cause) => new PlaywrightError({ cause }),
        }).pipe(
          Effect.withSpan(
            "Playwright/Page.with",
            {},
            {
              captureStackTrace: () => trace.stack,
            },
          ),
        )
      },
    }
  }),
}) {
  static readonly layerNoDeps = Layer.effect(this, this.make)
  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(BrowserContext.layer),
  )

  static with<A>(f: (page: Api.Page) => Promise<A>) {
    return Page.use((p) => p.with(f))
  }
}
