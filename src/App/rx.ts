import { Result, Rx } from "@effect-rx/rx-react"
import { Effect } from "effect"

export const installPromptRx = Rx.make((get) =>
  Effect.async<() => Promise<void>>((resume) => {
    const onBeforeInstallPrompt = (e: any) => {
      e.preventDefault()
      resume(
        Effect.succeed(async () => {
          await e.prompt()
          get.setSelf(Result.initial())
        }),
      )
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    return Effect.sync(() => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt)
    })
  }),
).pipe(Rx.keepAlive)
