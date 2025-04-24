import { NodeHttpClient } from "@effect/platform-node"
import * as OtlpTracer from "@effect/opentelemetry/OtlpTracer"
import { Config, Effect, Layer, Option, Redacted } from "effect"

export const TracerLayer = Layer.unwrapEffect(
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
    }).pipe(Layer.provide(NodeHttpClient.layerUndici))
  }),
)
