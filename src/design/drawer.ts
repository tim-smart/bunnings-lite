import { Effect, Schema, Stream } from "effect"
import { Mount, type View } from "@effect/ui"
import { Drawer } from "@effect/ui-kit"

/**
 * What had focus as each sheet's dialog opened, read before the kit moves
 * focus into it.
 */
const openers = new WeakMap<Element, Element | null>()
if (typeof document !== "undefined") {
  document.addEventListener(
    "beforetoggle",
    (event) => {
      if (
        (event as ToggleEvent).newState === "open" &&
        event.target instanceof HTMLDialogElement
      ) {
        openers.set(event.target, document.activeElement)
      }
    },
    true,
  )
}

/**
 * Gives focus back to the control that opened a sheet as soon as the sheet
 * is closed. The kit gives it back once the sheet has slid away, and until
 * then a Tab would move through a sheet that is already leaving. Mount it on
 * an element inside the sheet's dialog.
 *
 * The opener is the element whose id is `returnTo`, or else what had focus
 * when the dialog opened, or when the sheet was opened again on its way out.
 * Without one, or when focus has already left the sheet, it does nothing,
 * and the kit hands focus back once the sheet has gone.
 *
 * It moves focus in the render that closes the sheet. A sheet closed before
 * its opening transition starts settles at once, and the kit, seeing focus
 * still inside, would otherwise hand it to a control of its own choosing.
 */
const ReturnFocus = Mount.makeStream(
  "ReturnFocus",
  { args: { open: Schema.Boolean, returnTo: Schema.NullOr(Schema.String) } },
  (node: HTMLElement, args, changes) => {
    const dialog = node.closest("dialog")!
    const outside = (element: Element | null | undefined) =>
      element instanceof HTMLElement &&
      element !== element.ownerDocument.body &&
      !dialog.contains(element)
        ? element
        : undefined
    let opener = outside(openers.get(dialog))
    let open = args.open
    return changes.pipe(
      Stream.tap((next) =>
        Effect.sync(() => {
          if (next.open && !open) opener = outside(document.activeElement)
          if (!next.open && open && !outside(document.activeElement)) {
            const target =
              next.returnTo === null
                ? opener
                : outside(document.getElementById(next.returnTo))
            target?.focus({ preventScroll: true })
          }
          open = next.open
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
 * when it was opened by touch, so the keyboard doesn't come up. When the
 * sheet closes, focus goes back at once to where it was before it opened,
 * or to the element whose id is `returnFocusTo`, for a sheet nothing on the
 * page opened. The sheet is inert while it leaves.
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
                  h.div
                    .class(
                      "drawer-popup pointer-events-auto flex max-h-[80vh] w-full max-w-md flex-col rounded-t-lg border-t bg-background text-foreground",
                      options.class,
                    )
                    // On its way out it is only something to look at
                    .attr("inert", options.open ? undefined : ""),
                )
                .children(
                  h.div
                    .class("shrink-0 pt-4")
                    .attr("aria-hidden", "true")
                    .onMount(
                      ReturnFocus({
                        open: options.open,
                        returnTo: options.returnFocusTo ?? null,
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
