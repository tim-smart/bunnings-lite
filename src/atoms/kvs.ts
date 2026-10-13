import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import * as Atom from "effect/reactivity/Atom"

export const kvsRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)
