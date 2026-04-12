import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"
import * as Atom from "effect/unstable/reactivity/Atom"

export const kvsRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)
