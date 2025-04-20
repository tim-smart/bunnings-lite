import * as OtlpTracer from "@effect/opentelemetry/OtlpTracer"
import { NodeHttpClient } from "@effect/platform-node"
import { Layer } from "effect"

export const TracerLayer = OtlpTracer.layer({
  url: "http://localhost:4318",
  resource: {
    serviceName: "bunnings-api",
  },
}).pipe(Layer.provide(NodeHttpClient.layerUndici))
