import { Button } from "@/components/ui/button"
import { Result, useRxValue } from "@effect-rx/rx-react"
import { installPromptRx } from "./rx"
import { Option } from "effect"
import { Home } from "lucide-react"

export function InstallButton() {
  const result = Result.value(useRxValue(installPromptRx))
  if (Option.isNone(result)) {
    return null
  }
  return (
    <Button
      onClick={() => result.value()}
      className="bg-[#0D5257] text-white cursor-pointer hover:bg-[#0D5257]/90"
    >
      <Home />
      Add to home screen
    </Button>
  )
}
