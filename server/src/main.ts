import { Layer } from "effect"
import { HttpLayer } from "./Rpc"
import { NodeRuntime } from "@effect/platform-node"
import { TracerLayer } from "./Tracing"

HttpLayer.pipe(
  Layer.provideMerge(TracerLayer),
  Layer.launch,
  NodeRuntime.runMain,
)
