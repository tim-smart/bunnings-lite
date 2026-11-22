import { Effect, Schema, Stream } from "effect"
import { Mount, type View } from "@effect/ui"
import { Drawer } from "@effect/ui-kit"

/**
 * Focuses the element whose id is `target` as the sheet closes, unless focus
 * has already left the sheet. Mount it on an element inside the sheet's
 * dialog.
 *
 * The kit moves focus back on its own as the close starts: to the control
 * that opened the dialog, or else to what had focus before it opened. A
 * sheet that nothing on the page opened, such as one that opens itself when
 * a link arrives, has neither, and the kit's `finalFocus` part only marks an
 * element drawn inside the sheet's own view. Focus that this moves out first
 * is left where it is by the kit.
 */
const FocusOnClose = Mount.makeStream(
  "FocusOnClose",
  { args: { open: Schema.Boolean, target: Schema.NullOr(Schema.String) } },
  (node: HTMLElement, args, changes) => {
    const dialog = node.closest("dialog")!
    let open = args.open
    return changes.pipe(
      Stream.tap(({ open: next, target }) =>
        Effect.sync(() => {
          const focused = document.activeElement
          const inside = focused === document.body || dialog.contains(focused)
          if (open && !next && target !== null && inside) {
            document.getElementById(target)?.focus({ preventScroll: true })
          }
          open = next
        }),
      ),
      Stream.drain,
    )
  },
)

/**
 * A bottom sheet over the page: the ui-kit `Drawer`, as a modal. The page
 * behind it takes no presses and doesn't scroll, and focus stays inside.
 * Escape, a press on the backdrop, Android's back gesture and a swipe down
 * all send `onDismissed`, and the sheet stays open until `open` is false.
 *
 * The sheet slides up while `open`, and back down once it isn't. It stays
 * on the screen until it has left, then sends `onSettled`: a component that
 * mounts the sheet only while it is in use keeps it mounted until then.
 *
 * Focus starts on the first control in the sheet, or on the sheet itself
 * when it was opened by touch, so the keyboard doesn't come up. As the
 * sheet starts to close, the kit moves focus back to where it was before it
 * opened, and the sheet is inert while it leaves. A sheet that nothing on the
 * page opened sends focus to the element whose id is `returnFocusTo`.
 */
export const Sheet = <
  M,
  const D extends View.Children<M>,
  const C extends View.Children<M>,
>(
  h: View.H<M>,
  options: {
    readonly open: boolean
    readonly onDismissed: M
    readonly onSettled?: M | undefined
    readonly returnFocusTo?: string | undefined
    readonly title: string
    readonly description: D
    readonly class?: string | undefined
    readonly children: C
  },
) =>
  Drawer(h, {
    props: { open: options.open },
    onEmit: (event) =>
      event._tag === "Dismissed"
        ? options.onDismissed
        : event._tag === "Settled" && !event.open
          ? options.onSettled
          : undefined,
    // A view is one element, and the portal is there only while the sheet is
    // on the screen
    view: (drawer) =>
      h.div.class("contents").children(
        drawer.portal(h.dialog)?.children(
          drawer.backdrop(
            h.div.class("drawer-backdrop fixed inset-0 bg-black/50"),
          ),
          drawer
            .viewport(
              h.div.class(
                "fixed inset-0 flex items-end justify-center pointer-events-none",
              ),
            )
            .children(
              drawer
                .popup(
                  h.div.class(
                    "drawer-popup pointer-events-auto flex max-h-[80vh] w-full max-w-md flex-col rounded-t-lg border-t bg-background text-foreground",
                    options.class,
                  ),
                )
                .children(
                  h.div
                    .class("shrink-0 pt-4")
                    .attr("aria-hidden", "true")
                    .onMount(
                      FocusOnClose({
                        open: options.open,
                        target: options.returnFocusTo ?? null,
                      }),
                    )
                    .children(
                      h.div.class(
                        "bg-muted mx-auto h-2 w-[100px] rounded-full",
                      ),
                    ),
                  h.div
                    .class(
                      "flex flex-col gap-0.5 p-4 text-center select-none md:gap-1.5 md:text-left",
                    )
                    .children(
                      drawer
                        .title(h.h2.class("text-foreground font-semibold"))
                        .children(options.title),
                      drawer
                        .description(h.p.class("text-muted-foreground text-sm"))
                        .children(options.description),
                    ),
                  // What doesn't fit on a short screen scrolls here, under the
                  // header. A touch that starts here with the content at its
                  // top still swipes the sheet down.
                  drawer
                    .content(
                      h.div.class(
                        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain",
                      ),
                    )
                    .children(options.children),
                ),
            ),
        ),
      ),
  })

/** The buttons at the foot of a sheet. */
export const SheetFooter = <M>(h: View.H<M>) =>
  h.div.class("mt-auto flex flex-col gap-2 p-4")
