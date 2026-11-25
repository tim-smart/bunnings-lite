import * as Clipboard from "@effect/platform-browser/Clipboard"
import { Effect, Layer, Option, Schema, Stream } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, Subscription, UiSchema } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { buttonClass, inputClass } from "../../design/classes.ts"
import { Sheet, SheetFooter } from "../../design/drawer.ts"
import { Icon } from "../../design/icons.ts"
import { Skeleton } from "../../design/skeleton.ts"
import { GetSyncSettings } from "../queries/GetSyncSettings.ts"
import { Invites } from "../services/Invites.ts"
import { SyncRemote } from "../services/SyncRemote.ts"
import { SyncSettings } from "../services/SyncSettings.ts"

export const SyncSettingsPanelMessage = UiSchema.TaggedEnum({
  RequestedClose: {},
  UpdatedRemoteUrl: { text: Schema.String },
  ClickedCopyInvite: {},
  CompletedCopyInvite: { copied: Schema.Boolean },
  ExpiredCopiedNotice: {},
  SettledSheet: {},
})

/** `Closed` asks to close, and `Left` says the closed drawer has gone. */
export const SyncSettingsPanelEvents = UiSchema.TaggedEnum({
  Closed: {},
  Left: {},
})

/** Saves the remote to sync with, or none, and connects to it. */
export class SetRemoteUrl extends Command.Service<SetRemoteUrl>()(
  "sync/SetRemoteUrl",
  {
    args: { url: Schema.NullOr(Schema.String) },
    invalidates: () => [GetSyncSettings],
  },
  Effect.gen(function* () {
    const remote = yield* SyncRemote
    return ({ url }) =>
      remote
        .setUrl(Option.map(Option.fromNullishOr(url), (url) => new URL(url)))
        .pipe(Effect.as(Component.noop))
  }),
) {}

/**
 * Copies a link that invites another device, and answers with whether a link
 * was copied. The link holds a private key, so it goes straight to the
 * clipboard and never through the component.
 */
export class CopyInvite extends Command.Service<CopyInvite>()(
  "sync/CopyInvite",
  { args: {} },
  Effect.gen(function* () {
    const invites = yield* Invites
    const clipboard = yield* Clipboard.Clipboard
    return () =>
      invites.link.pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(false),
            onSome: (link) =>
              clipboard.writeString(link).pipe(
                Effect.as(true),
                Effect.orElseSucceed(() => false),
              ),
          }),
        ),
        Effect.map((copied) =>
          SyncSettingsPanelMessage.CompletedCopyInvite({ copied }),
        ),
      )
  }),
) {}

// The URL a remote field holds: none when blank, and nothing to save while
// what is typed isn't a URL yet
const remoteUrlOf = (text: string): string | null | undefined => {
  const trimmed = text.trim()
  if (trimmed === "") return null
  return URL.canParse(trimmed) ? trimmed : undefined
}

/**
 * The sync settings, in a drawer. Mount it outside the page it covers, while
 * it is open and then until the drawer has left. It reports when it is
 * closed.
 */
export const SyncSettingsPanelNoDeps = Html.component({
  name: "SyncSettingsPanel",
  props: Schema.Struct({ open: Schema.Boolean }),
  model: Schema.Struct({
    /** What was typed into the remote field. It shows the saved one until then. */
    remoteUrl: Schema.NullOr(Schema.String),
    /** Whether an invite link was just copied. */
    copied: Schema.Boolean,
  }),
  message: SyncSettingsPanelMessage,
  events: SyncSettingsPanelEvents,
  queries: {
    settings: { query: GetSyncSettings, args: () => ({}) },
  },
}).make({
  init: () => ({ remoteUrl: null, copied: false }),
  update: ($, message) =>
    SyncSettingsPanelMessage.match(message, {
      RequestedClose: () => $.emit(SyncSettingsPanelEvents.Closed()),
      UpdatedRemoteUrl: ({ text }) => {
        const url = remoteUrlOf(text)
        return url === undefined
          ? $.evolve({ remoteUrl: text })
          : $.evolve({ remoteUrl: text }).run(SetRemoteUrl.make({ url }))
      },
      ClickedCopyInvite: () => $.run(CopyInvite.make()),
      CompletedCopyInvite: ({ copied }) => $.evolve({ copied }),
      ExpiredCopiedNotice: () => $.evolve({ copied: false }),
      SettledSheet: () => $.emit(SyncSettingsPanelEvents.Left()),
    }),
  subscriptions: ({ model }) => [
    model.copied &&
      Subscription.make(
        "sync/copiedExpires",
        Stream.fromEffect(
          Effect.as(
            Effect.sleep("2 seconds"),
            SyncSettingsPanelMessage.ExpiredCopiedNotice(),
          ),
        ),
      ),
  ],
  view: (h, model) => {
    const labelClass = "flex flex-col gap-1.5 text-sm font-medium"

    return Sheet(h, {
      open: h.props.open,
      onDismissed: SyncSettingsPanelMessage.RequestedClose(),
      onSettled: SyncSettingsPanelMessage.SettledSheet(),
      title: "Sync settings",
      description: ["Keep your favourites in step across devices."],
      children: [
        AsyncResult.match(h.queries.settings, {
          onInitial: () =>
            h.div
              .class("px-4 pb-2 flex flex-col gap-4")
              .children(Skeleton(h, "h-10 w-full"), Skeleton(h, "h-10 w-full")),
          onFailure: () => h.div(),
          onSuccess: ({ value: settings }) =>
            h.div.class("px-4 pb-2 flex flex-col gap-4").children(
              h.label.class(labelClass).children(
                "Remote URL",
                h.input
                  .id("remote-url")
                  .attr("placeholder", "https://")
                  .class(inputClass())
                  .value(model.remoteUrl ?? settings.remoteUrl ?? "")
                  .onInput(({ value }) =>
                    SyncSettingsPanelMessage.UpdatedRemoteUrl({ text: value }),
                  ),
              ),
              h.label.class(labelClass).children(
                "Identity",
                // Switching identity discards local data, so it goes
                // through the invite prompt instead
                h.input
                  .id("identity")
                  .attr("readonly", "")
                  .class(inputClass())
                  .value(settings.identity),
              ),
              h.div
                .class(
                  "flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-400/30 dark:bg-amber-400/10",
                )
                .children(
                  h.p
                    .class("flex gap-2 text-amber-900 dark:text-amber-200")
                    .children(
                      Icon(h, "triangleAlert", {
                        class: "size-4 shrink-0 mt-0.5",
                      }),
                      h.span(
                        "An invite link gives full access to your synced favorites. Whoever has it can read, change and clear them, from any device, and it can't be revoked later. Only send it to people you trust.",
                      ),
                    ),
                  h.button
                    .attr("type", "button")
                    .disabled(settings.remoteUrl === null)
                    .class(buttonClass({ variant: "outline" }))
                    .onClick(SyncSettingsPanelMessage.ClickedCopyInvite())
                    .children(
                      Icon(h, model.copied ? "check" : "copy"),
                      "Copy invite link",
                    ),
                  settings.remoteUrl === null &&
                    h.p
                      .class("text-muted-foreground")
                      .children("Set a remote URL to create an invite."),
                  model.copied &&
                    h.p
                      .attr("role", "status")
                      .class("text-muted-foreground")
                      .children("Copied. Send it privately."),
                ),
            ),
        }),
        SheetFooter(h).children(
          h.button
            .attr("type", "button")
            .class(buttonClass({ variant: "outline" }))
            .onClick(SyncSettingsPanelMessage.RequestedClose())
            .children("Close"),
        ),
      ],
    })
  },
})

export const SyncSettingsPanel = SyncSettingsPanelNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(
      GetSyncSettings.layer,
      SetRemoteUrl.layer,
      CopyInvite.layer,
    ).pipe(
      Layer.provide([SyncSettings.layer, SyncRemote.layer, Invites.layer]),
    ),
  ),
)
