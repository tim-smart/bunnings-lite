import { Button } from "@/components/ui/button"
import { installPromptAtom } from "./atoms"
import { Home } from "lucide-react"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { useAtomValue } from "@effect/atom-react"

export function InstallButton() {
  return AsyncResult.builder(useAtomValue(installPromptAtom))
    .onSuccess((install) => (
      <Button onClick={install} className="cursor-pointer">
        <Home />
        Add to home screen
      </Button>
    ))
    .render()
}
