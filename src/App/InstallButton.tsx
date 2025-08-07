import { Button } from "@/components/ui/button"
import { Result, useAtomValue } from "@effect-atom/atom-react"
import { installPromptAtom } from "./atoms"
import { Home } from "lucide-react"

export function InstallButton() {
  return Result.builder(useAtomValue(installPromptAtom))
    .onSuccess((install) => (
      <Button onClick={() => install} className="cursor-pointer">
        <Home />
        Add to home screen
      </Button>
    ))
    .render()
}
