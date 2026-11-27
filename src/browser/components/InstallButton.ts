import { Effect, Schema, Stream } from "effect"
import { Command, Component, Subscription, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { buttonClass } from "../../design/classes.ts"
import { Icon } from "../../design/icons.ts"
import { InstallPrompt } from "../services/InstallPrompt.ts"

export const InstallButtonMessage = UiSchema.TaggedEnum({
  ChangedAvailability: { available: Schema.Boolean },
  ClickedInstall: {},
})

/** Shows the browser's prompt to install the app. */
export class PromptInstall extends Command.Service<PromptInstall>()(
  "browser/PromptInstall",
) {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const install = yield* InstallPrompt
      return () => install.prompt
    }),
  )
}

const installAvailable = Subscription.make(
  "browser/installAvailable",
  InstallPrompt.useSync((install) =>
    install.available.pipe(
      Stream.map((available) =>
        InstallButtonMessage.ChangedAvailability({ available }),
      ),
    ),
  ).pipe(Stream.unwrap),
)

/** Offers to install the app, once the browser says it can be. */
export const InstallButtonNoDeps = Html.component({
  name: "InstallButton",
  model: Schema.Struct({ available: Schema.Boolean }),
  message: InstallButtonMessage,
}).make({
  init: () => ({ available: false }),
  update: ($, message) =>
    InstallButtonMessage.match(message, {
      ChangedAvailability: ({ available }) => ({ available }),
      ClickedInstall: () => $.run(PromptInstall.make()),
    }),
  subscriptions: () => [installAvailable],
  view: (h, model) =>
    h.div(
      model.available &&
        h.button
          .attr("type", "button")
          .class(buttonClass({ class: "cursor-pointer" }))
          .on("click", InstallButtonMessage.ClickedInstall())
          .children(Icon(h, "house"), "Add to home screen"),
    ),
})

export const InstallButton = InstallButtonNoDeps.pipe(
  Component.provide(PromptInstall.layer),
)
