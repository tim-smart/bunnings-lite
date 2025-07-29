import { Rx } from "@effect-rx/rx-react"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"

export const kvsRuntime = Rx.runtime(BrowserKeyValueStore.layerLocalStorage)
