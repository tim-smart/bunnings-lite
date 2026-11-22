import { Effect, Schema, Stream } from "effect"
import { Command, Component, Subscription } from "@effect/ui"
import { buttonClass } from "../../design/classes.ts"
import { icon } from "../../design/icons.ts"
import { InstallPrompt } from "../services/InstallPrompt.ts"

export const InstallButtonMessage = Schema.TaggedUnion({
  AvailabilityChanged: { available: Schema.Boolean },
  Pressed: {},
})
const Message = InstallButtonMessage

/** Shows the browser's prompt to install the app. */
export class PromptInstall extends Command.Service<PromptInstall>()(
  "browser/PromptInstall",
  { args: {} },
  Effect.gen(function* () {
    const install = yield* InstallPrompt
    return () => Effect.as(install.prompt, Component.noop)
  }),
) {}

const installAvailable = Subscription.make(
  "browser/installAvailable",
  InstallPrompt.useSync((install) =>
    install.available.pipe(
      Stream.map((available) =>
        Message.make({ _tag: "AvailabilityChanged", available }),
      ),
    ),
  ).pipe(Stream.unwrap),
)

/** Offers to install the app, once the browser says it can be. */
export const InstallButtonNoDeps = Component.define({
  name: "InstallButton",
  scoped: false,
  model: Schema.Struct({ available: Schema.Boolean }),
  message: Message,
}).make({
  init: () => ({ available: false }),
  update: (_model, message, $) =>
    Message.match(message, {
      AvailabilityChanged: ({ available }) => ({ available }),
      Pressed: () => $.run(PromptInstall.make()),
    }),
  subscriptions: () => [installAvailable],
  view: (model, h) =>
    h.div(
      model.available &&
        h.button
          .attr("type", "button")
          .class(buttonClass({ class: "cursor-pointer" }))
          .onClick(Message.make({ _tag: "Pressed" }))
          .children(icon(h, "house"), "Add to home screen"),
    ),
})

export const InstallButton = InstallButtonNoDeps.pipe(
  Component.provide(PromptInstall.layer),
)
