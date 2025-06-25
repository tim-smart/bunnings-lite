import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import { Rx } from "@effect-rx/rx-react"
import { ConfigProvider, Layer, Logger } from "effect"
import { TracerLayer } from "./Tracing.ts"
import "./index.css"

const configProvider = ConfigProvider.fromJson(import.meta.env)

Rx.runtime.addGlobalLayer(
  TracerLayer.pipe(
    Layer.provideMerge(Layer.setConfigProvider(configProvider)),
    Layer.provideMerge(Logger.pretty),
  ),
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
