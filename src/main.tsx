import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.tsx"
import { Rx } from "@effect-rx/rx-react"
import { TracerLayer } from "./Tracing.ts"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
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
