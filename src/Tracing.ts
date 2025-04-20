import * as OtlpTracer from "@effect/opentelemetry/OtlpTracer"
import { FetchHttpClient } from "@effect/platform"
import { Layer } from "effect"

export const TracerLayer = OtlpTracer.layer({
  url: "http://localhost:4318",
  resource: {
    serviceName: "bunnings-client",
  },
}).pipe(Layer.provide(FetchHttpClient.layer))
