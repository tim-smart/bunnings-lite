import "@effect/ui/html/register"
import "./index.css"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import * as BrowserSocket from "@effect/platform-browser/BrowserSocket"
import * as Clipboard from "@effect/platform-browser/Clipboard"
import * as Geolocation from "@effect/platform-browser/Geolocation"
import { Config, ConfigProvider, Effect, Layer } from "effect"
import { RpcClient, RpcSerialization } from "effect/rpc"
import { Socket } from "effect/socket"
import { Router } from "@effect/ui"
import { BrowserHost, BrowserRouter } from "@effect/ui/html"
import { registerSW } from "virtual:pwa-register"
import { App } from "./App.ts"
import { DrawerDrag } from "./browser/services/DrawerDrag.ts"
import { ElementSize } from "./browser/services/ElementSize.ts"
import { InstallPrompt } from "./browser/services/InstallPrompt.ts"
import { Reload } from "./browser/services/Reload.ts"
import { ScrollbarWidth } from "./browser/services/ScrollbarWidth.ts"
import { Share } from "./browser/services/Share.ts"
import { UrlFragment } from "./browser/services/UrlFragment.ts"
import { Viewport } from "./browser/services/Viewport.ts"
import { AppRoute } from "./routes.ts"
import { TracerLayer } from "./Tracing.ts"

// The entry module mounts the app and provides the platform: the Router, the
// transport to the server, storage, the browser APIs the app listens to, what
// a drawer needs of the page (its drag and the scrollbar's width), tracing
// and config. Every domain Layer is provided by the component that needs it.

// The socket the Bunnings Lite RPC client talks over
const ApiTransport = RpcClient.layerProtocolSocket({
  retryTransientErrors: true,
}).pipe(
  Layer.provide(RpcSerialization.layerJson),
  Layer.provide(
    Layer.unwrap(
      Effect.map(Config.String("VITE_API_URL"), (url) =>
        BrowserSocket.layerWebSocket(url),
      ),
    ),
  ),
  Layer.orDie,
)

const Platform = Layer.mergeAll(
  BrowserRouter.layer({ routes: AppRoute }),
  ApiTransport,
  BrowserKeyValueStore.layerLocalStorage,
  // The sync remote opens its own socket to the URL in the settings
  Socket.layerWebSocketConstructorGlobal,
  Geolocation.layer,
  Clipboard.layer,
  Viewport.layer,
  ElementSize.layer,
  InstallPrompt.layer,
  Share.layer,
  Reload.layer,
  DrawerDrag,
  ScrollbarWidth,
  TracerLayer,
).pipe(
  // First, so an invite is out of the address bar before the Router reads it
  Layer.provideMerge(UrlFragment.layer),
  Layer.provide(
    Layer.succeed(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv({ env: import.meta.env }),
    ),
  ),
)

const Main = BrowserHost.mount(
  App,
  Router.props(AppRoute),
  document.getElementById("root")!,
).pipe(Layer.provide(Platform))

Layer.launch(Main).pipe(Effect.runFork)

registerSW({ immediate: true })
