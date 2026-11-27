import { Effect, Layer, Option, Schema, Stream } from "effect"
import { AsyncResult } from "effect/reactivity"
import { Command, Component, Subscription, UiSchema } from "@effect/ui"
import { Html, HtmlCommand } from "@effect/ui/html"
import { buttonClass } from "../../design/classes.ts"
import { Sheet, SheetFooter } from "../../design/drawer.ts"
import { PendingInvite } from "../domain/Invite.ts"
import { GetSyncSettings } from "../queries/GetSyncSettings.ts"
import { Invites } from "../services/Invites.ts"
import { SyncSettings } from "../services/SyncSettings.ts"

export const InviteDialogMessage = UiSchema.TaggedEnum({
  OpenedInvite: { invite: PendingInvite },
  RequestedClose: {},
  ClickedJoin: {},
  SettledSheet: {},
})

/** Whether the dialog is showing, for its owner to close any other drawer. */
export const InviteDialogEvents = UiSchema.TaggedEnum({
  Opened: {},
  Closed: {},
})

/**
 * Joins through the invite that was opened. The page reloads to finish it,
 * so this only resolves if there was nothing to join.
 */
export class JoinSync extends Command.Service<JoinSync>()("sync/JoinSync") {
  static readonly layer = this.toLayer(
    Effect.gen(function* () {
      const invites = yield* Invites
      return () => invites.join
    }),
  )
}

const invitesOpened = Subscription.make(
  "sync/invitesOpened",
  Stream.unwrap(
    Effect.map(Invites, (invites) =>
      invites.opened.pipe(
        Stream.map((invite) => InviteDialogMessage.OpenedInvite({ invite })),
      ),
    ),
  ),
)

/** The button that turns the invite down: Cancel, or Close on a bad link. */
const dismissRef = Html.ref("invite-dismiss", "button")

/**
 * Asks before joining through an invite link the page was opened with, and
 * says so when the link can't be read. It is a drawer, and `Shell`
 * mounts it with the others so that only one is open.
 */
export const InviteDialogNoDeps = Html.component({
  name: "InviteDialog",
  props: Schema.Struct({
    /** The id of the element that gets focus when the dialog closes. */
    returnFocusTo: Schema.String,
  }),
  model: Schema.Struct({
    /**
     * The invite waiting for an answer. It stays after the answer, for the
     * drawer to show while it leaves.
     */
    invite: Schema.NullOr(PendingInvite),
    /** Whether the drawer is open, asking. */
    open: Schema.Boolean,
  }),
  message: InviteDialogMessage,
  events: InviteDialogEvents,
  queries: {
    settings: { query: GetSyncSettings, args: () => ({}) },
  },
}).make({
  init: () => ({ invite: null, open: false }),
  update: ($, message) =>
    InviteDialogMessage.match(message, {
      // The sheet focuses its first button, the one that turns the invite
      // down, as it opens. An invite that replaces one already showing moves
      // focus back there too, so that Enter never joins one the user hasn't
      // read. Only then: on an open, focusing it here as well races the
      // sheet's own focus, which comes a frame later.
      OpenedInvite: ({ invite }) => {
        const opened = $.set({ invite, open: true }).emit(
          InviteDialogEvents.Opened(),
        )
        return $.model.open
          ? opened.run(HtmlCommand.focus(dismissRef, () => Component.noop))
          : opened
      },
      RequestedClose: () =>
        $.evolve({ open: false }).emit(InviteDialogEvents.Closed()),
      ClickedJoin: () =>
        $.evolve({ open: false })
          .run(JoinSync.make())
          .emit(InviteDialogEvents.Closed()),
      // Unless another invite arrived while it was leaving
      SettledSheet: () => ($.model.open ? $.model : $.evolve({ invite: null })),
    }),
  subscriptions: () => [invitesOpened],
  view: (h, model) => {
    const { invite, open } = model
    if (invite === null) return h.div()
    const dismissed = InviteDialogMessage.RequestedClose()
    const left = InviteDialogMessage.SettledSheet()

    // Nothing on the page opened it, so focus goes where the owner says
    const sheet = {
      open,
      onDismissed: dismissed,
      onSettled: left,
      returnFocusTo: h.props.returnFocusTo,
    }

    if (invite._tag === "Invalid") {
      return Sheet(h, {
        ...sheet,
        title: "Invite link not valid",
        description: [
          "This link is incomplete or damaged, so your sync settings were left unchanged. Ask for a new invite.",
        ],
        children: [
          SheetFooter(h).children(
            h.button
              .ref(dismissRef)
              .attr("type", "button")
              .class(buttonClass({ variant: "outline" }))
              .on("click", dismissed)
              .children("Close"),
          ),
        ],
      })
    }

    const currentRemote = Option.flatMapNullishOr(
      AsyncResult.value(h.queries.settings),
      ({ remoteUrl }) => (remoteUrl === null ? null : new URL(remoteUrl).host),
    )
    return Sheet(h, {
      ...sheet,
      title: "Join shared sync?",
      description: [
        "This invite connects this device to ",
        h.span.class("font-medium text-foreground").children(invite.host),
        " using the identity of whoever created it.",
      ],
      children: [
        h.div.class("px-4 text-sm flex flex-col gap-3").children(
          h.ul.class("list-disc pl-5 flex flex-col gap-1").children(
            h.li(
              "Everyone with this invite shares one set of favorites, with full access to read, change and clear them.",
            ),
            h.li(
              "Joining discards this device's favorites and shows the shared ones instead. Favorites already synced stay on the server under this device's old identity, but you won't see them again unless you copy an invite link for it first.",
            ),
            h.li("Access can't be revoked later."),
            h.li(
              "This replaces this device's identity",
              Option.match(currentRemote, {
                onNone: () => "",
                onSome: (host) => ` and its current remote (${host})`,
              }),
              ".",
            ),
          ),
          h.p
            .class("text-muted-foreground")
            .children(
              "Bunnings Lite can't check who made an invite. Only join if you know the sender and were expecting it.",
            ),
        ),
        SheetFooter(h).children(
          h.button
            .ref(dismissRef)
            .attr("type", "button")
            .class(buttonClass({ variant: "outline" }))
            .on("click", dismissed)
            .children("Cancel"),
          h.button
            .attr("type", "button")
            .class(buttonClass())
            .on("click", InviteDialogMessage.ClickedJoin())
            .children("Join"),
        ),
      ],
    })
  },
})

export const InviteDialog = InviteDialogNoDeps.pipe(
  Component.provide(
    Layer.mergeAll(GetSyncSettings.layer, JoinSync.layer).pipe(
      Layer.provide([SyncSettings.layer, Invites.layer]),
    ),
  ),
)
