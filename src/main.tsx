import "./BigIntPolyfill.ts"
import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import * as Atom from "effect/reactivity/Atom"
import { TracerLayer } from "./Tracing.ts"
import "./index.css"
import * as Layer from "effect/Layer"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { applyPendingJoin } from "./Sync/atoms.ts"

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

await Effect.runPromise(applyPendingJoin)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
