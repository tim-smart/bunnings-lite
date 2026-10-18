// In-memory encrypted event log server for e2e tests
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as NodeSocketServer from "@effect/platform-node/NodeSocketServer"
import * as EventLogServerEncrypted from "effect/eventlog/EventLogServerEncrypted"
import * as Layer from "effect/Layer"
import * as RpcSerialization from "effect/rpc/RpcSerialization"
import * as RpcServer from "effect/rpc/RpcServer"

EventLogServerEncrypted.layer.pipe(
  Layer.provide(EventLogServerEncrypted.layerStorageMemory),
  Layer.provide(RpcServer.layerProtocolSocketServer),
  Layer.provide(RpcSerialization.layerSchemaBinary()),
  Layer.provide(
    NodeSocketServer.layerWebSocket({
      host: "127.0.0.1",
      port: Number(process.argv[2]),
    }),
  ),
  Layer.launch,
  NodeRuntime.runMain,
)
