import { Effect, Stream } from "effect"
import { Subscription, type View } from "@effect/ui"
import type { H } from "./h.ts"

/**
 * How long a closed drawer takes to leave the screen. It matches
 * `--drawer-duration` in `index.css`.
 */
const drawerLeaving = "500 millis"

/**
 * Sends `message` once a drawer that was just closed has left the screen,
 * which is when to unmount it. Subscribe while it is closed and still
 * mounted. `name` tells one drawer's wait from another's.
 */
export const drawerLeft = <Msg>(name: string, message: Msg) =>
  Subscription.make(
    `design/drawerLeft:${name}`,
    Stream.fromEffect(Effect.as(Effect.sleep(drawerLeaving), message)),
  )

/**
 * A bottom sheet over the page, as a modal `dialog`: the browser shows it
 * in the top layer, makes everything else inert and keeps focus inside.
 * Escape, a press on the backdrop and a drag down by its handle or header
 * all send `onClose`.
 *
 * The sheet slides up while `open`, and back down once it isn't. Closing
 * hands the page back at once, so keep the drawer mounted until
 * `drawerLeft` says it has gone, or it disappears where it stands.
 *
 * Focus starts on the control marked `autofocus`, or the first one. When
 * the sheet is closed, the host hands focus back to where it was before the
 * sheet opened.
 *
 * `titleId` is the id `drawerHeader` gives the title, which names the dialog.
 */
export const drawer = <Msg, const C extends ReadonlyArray<View.Input<Msg>>>(
  h: H<Msg>,
  options: {
    readonly titleId: string
    readonly open: boolean
    readonly onClose: Msg
    readonly class?: string
  },
  ...children: C
) =>
  h.dialog
    .modal(options.open)
    .onCancel(options.onClose)
    .attr("aria-labelledby", options.titleId)
    .attr("aria-describedby", `${options.titleId}-description`)
    // On its way out it is only something to look at
    .attr("inert", options.open ? undefined : "")
    .class(
      "drawer fixed inset-0 z-50 m-0 size-full max-h-none max-w-none border-0 bg-transparent p-0 text-foreground backdrop:bg-transparent",
    )
    .children(
      // The dialog fills the screen so that its own backdrop can be pressed.
      // `::backdrop` takes no handler, and `closedby` isn't in every browser.
      h.div
        .class("drawer-backdrop absolute inset-0 bg-black/50")
        .attr("aria-hidden", "true")
        .onClick(options.onClose),
      h.div
        .class(
          "drawer-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[80vh] w-full max-w-md flex-col rounded-t-lg border-t bg-background",
          options.class,
        )
        .children(
          h.div
            .class("drawer-grip shrink-0 pt-4")
            .attr("aria-hidden", "true")
            .children(
              h.div.class("bg-muted mx-auto h-2 w-[100px] rounded-full"),
            ),
          // What doesn't fit on a short screen scrolls here, under the handle.
          // The dialog can't scroll, so nothing else would bring a focused
          // control into view.
          h.div
            .class("drawer-body flex min-h-0 flex-1 flex-col overflow-y-auto")
            .children(...children),
        ),
    )

export const drawerHeader = <
  Msg,
  const C extends ReadonlyArray<View.Input<Msg>>,
>(
  h: H<Msg>,
  options: { readonly titleId: string; readonly title: string },
  ...description: C
) =>
  h.div
    .class(
      "drawer-grip flex flex-col gap-0.5 p-4 text-center md:gap-1.5 md:text-left",
    )
    .children(
      h.h2
        .id(options.titleId)
        .class("text-foreground font-semibold")
        .children(options.title),
      h.p
        .id(`${options.titleId}-description`)
        .class("text-muted-foreground text-sm")
        .children(...description),
    )

export const drawerFooter = <
  Msg,
  const C extends ReadonlyArray<View.Input<Msg>>,
>(
  h: H<Msg>,
  ...children: C
) => h.div.class("mt-auto flex flex-col gap-2 p-4").children(...children)
