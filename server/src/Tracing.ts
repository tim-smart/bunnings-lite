import { NodeHttpClient } from "@effect/platform-node"
import { Config, Effect, Layer, Option, Redacted } from "effect"
import { OtlpSerialization, OtlpTracer } from "effect/unstable/observability"

export const TracerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const apiKey = yield* Config.redacted("HONEYCOMB_API_KEY").pipe(
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
        serviceName: "bunnings-api",
      },
    }).pipe(
      Layer.provide([NodeHttpClient.layerUndici, OtlpSerialization.layerJson]),
    )
  }),
)
