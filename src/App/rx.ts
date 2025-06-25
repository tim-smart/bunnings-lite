import { Rx } from "@effect-rx/rx-react"
import * as Effect from "effect/Effect"

export const installPromptRx = Rx.make((get) =>
  Effect.async<() => Promise<void>>((resume) => {
    const onBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      resume(
        Effect.succeed(async () => {
          await e.prompt()
          await e.userChoice
          get.refreshSelf()
        }),
      )
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt, {
      once: true,
    })
    return Effect.sync(() => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    })
  }),
).pipe(Rx.keepAlive)
