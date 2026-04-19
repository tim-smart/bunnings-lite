import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import * as Atom from "effect/unstable/reactivity/Atom"
import { TracerLayer } from "./Tracing.ts"
import "./index.css"
import * as Layer from "effect/Layer"
import * as ConfigProvider from "effect/ConfigProvider"

if (typeof globalThis.BigInt === "undefined") {
  globalThis.BigInt = ((input: string | number | bigint) => {
    return Math.floor(Number(input))
  }) as any
}

Atom.runtime.addGlobalLayer(
  TracerLayer.pipe(
    Layer.merge(
      Layer.succeed(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromEnv({ env: import.meta.env }),
      ),
    ),
  ),
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
