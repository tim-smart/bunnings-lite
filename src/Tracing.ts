import * as Config from "effect/Config"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Redacted from "effect/Redacted"
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization"
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"

export const TracerLayer = Layer.unwrap(
  Effect.gen(function* () {
    const apiKey = yield* Config.redacted("VITE_HONEYCOMB_API_KEY").pipe(
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
