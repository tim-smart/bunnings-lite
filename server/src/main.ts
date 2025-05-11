import { Layer } from "effect"
import { HttpLayer } from "./Rpc"
import { NodeRuntime } from "@effect/platform-node"
import { DevTools } from "@effect/experimental"
import { TracerLayer } from "./Tracing"

HttpLayer.pipe(
  Layer.provideMerge(TracerLayer),
  Layer.provideMerge(DevTools.layer()),
  Layer.launch,
  NodeRuntime.runMain,
)
