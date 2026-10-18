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
import * as Exit from "effect/Exit"
import { applyPendingJoin } from "./Sync/atoms.ts"
import { Button } from "./components/ui/button.tsx"

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

const root = ReactDOM.createRoot(document.getElementById("root")!)
const joinResult = await Effect.runPromiseExit(
  applyPendingJoin(() => {
    root.render(
      <main className="mx-auto max-w-md space-y-4 p-6" role="status">
        <h1 className="text-xl font-semibold">Waiting to finish joining</h1>
        <p>Close other Bunnings Lite tabs or windows to finish joining.</p>
        <p>This page will continue automatically once they are closed.</p>
      </main>,
    )
  }),
)

if (Exit.isFailure(joinResult)) {
  // Keep the journal closed until all settings are saved. The pending marker
  // is removed last, so reloading safely retries the whole join.
  root.render(
    <main className="mx-auto max-w-md space-y-4 p-6" role="alert">
      <h1 className="text-xl font-semibold">Could not finish joining</h1>
      <p>Check that browser storage is available, then try again.</p>
      <Button onClick={() => location.reload()}>Retry</Button>
    </main>,
  )
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
