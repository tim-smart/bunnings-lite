import { Layer } from "effect"
import { HttpLayer } from "./Rpc"
import { NodeRuntime } from "@effect/platform-node"

HttpLayer.pipe(
  // Layer.provideMerge(TracerLayer),
  // Layer.provideMerge(DevTools.layer()),
  Layer.launch,
  NodeRuntime.runMain,
)
