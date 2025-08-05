import { Button } from "@/components/ui/button"
import { Result, useRxValue } from "@effect-rx/rx-react"
import { installPromptRx } from "./rx"
import { Home } from "lucide-react"

export function InstallButton() {
  return Result.builder(useRxValue(installPromptRx))
    .onSuccess((install) => (
      <Button onClick={() => install} className="cursor-pointer">
        <Home />
        Add to home screen
      </Button>
    ))
    .orNull()
}
