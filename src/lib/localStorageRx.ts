import { Result, Rx } from "@effect-rx/rx-react"
import { KeyValueStore } from "@effect/platform"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { PlatformError } from "@effect/platform/Error"
import { Effect, Option, Schema } from "effect"
import { ParseError } from "effect/ParseResult"

const runtime = Rx.runtime(BrowserKeyValueStore.layerLocalStorage)

export const localStorageRx = <A, I>(options: {
  readonly key: string
  readonly schema: Schema.Schema<A, I>
  readonly defaultValue: A
}): Rx.Writable<Result.Result<A, PlatformError | ParseError>, A> => {
  const setRx = runtime.fn(
    Effect.fnUntraced(function* (value: A) {
      const store = (yield* KeyValueStore.KeyValueStore).forSchema(
        options.schema,
      )
      yield* store.set(options.key, value)
    }),
  )
  return Rx.writable(
    runtime.rx(
      Effect.fnUntraced(function* (get: Rx.Context) {
        const store = (yield* KeyValueStore.KeyValueStore).forSchema(
          options.schema,
        )
        get.mount(setRx)
        return Option.getOrElse(
          yield* store.get(options.key),
          () => options.defaultValue,
        )
      }),
    ).read,
    (ctx, value: A) => {
      console.log("set", value)
      ctx.set(setRx, value as any)
      ctx.setSelf(Result.success(value))
    },
  )
}
