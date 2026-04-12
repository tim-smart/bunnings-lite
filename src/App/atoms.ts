import * as Effect from "effect/Effect"
import * as Atom from "effect/unstable/reactivity/Atom"

export const installPromptAtom = Atom.make((get) =>
  Effect.callback<() => Promise<void>>((resume) => {
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
).pipe(Atom.keepAlive)
