import { Layer } from "effect"
import { HttpLayer } from "./Rpc"
import { NodeRuntime } from "@effect/platform-node"

HttpLayer.pipe(Layer.launch, NodeRuntime.runMain)
