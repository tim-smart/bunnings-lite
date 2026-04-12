import { Layer } from "effect"
import { HttpLayer } from "./Rpc.ts"
import { NodeRuntime } from "@effect/platform-node"
import { TracerLayer } from "./Tracing.ts"

HttpLayer.pipe(
  Layer.provideMerge(TracerLayer),
  Layer.launch,
  NodeRuntime.runMain,
)
