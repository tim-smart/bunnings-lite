import { Config, Effect, Layer, Option, Redacted } from "effect"
import { FetchHttpClient } from "effect/http"
import { OtlpSerialization, OtlpTracer } from "effect/observability"

/** Sends traces to Honeycomb when `VITE_HONEYCOMB_API_KEY` is set. */
export const TracerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const apiKey = yield* Config.Redacted("VITE_HONEYCOMB_API_KEY").pipe(
      Config.option,
    )
    if (Option.isNone(apiKey)) {
      return Layer.empty
    }
    return OtlpTracer.layer({
      url: "https://api.honeycomb.io/v1/traces",
      headers: {
        "X-Honeycomb-Team": Redacted.value(apiKey.value),
        "X-Honeycomb-Dataset": "bunnings-lite",
      },
      resource: {
        serviceName: "bunnings-client",
      },
    }).pipe(Layer.provide([OtlpSerialization.layerJson, FetchHttpClient.layer]))
  }),
)
