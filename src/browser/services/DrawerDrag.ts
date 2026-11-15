import { Effect, Layer } from "effect"

/** A drag past this share of the sheet's height closes it. */
const closeAt = 0.25
/** So does a drag that was faster than this over its length, in pixels a millisecond. */
const flickAt = 0.4
/** A press that moves less than this is a press, not a drag. */
const slop = 3

interface Drag {
  readonly dialog: HTMLDialogElement
  readonly panel: HTMLElement
  readonly backdrop: HTMLElement | null
  readonly pointerId: number
  readonly startY: number
  readonly startAt: number
  readonly height: number
  /** How far down the sheet is held, in pixels. */
  offset: number
}

/**
 * Lets a bottom sheet be dragged down by its handle or header to close it
 * (see `design/drawer.ts`). The sheet follows the pointer and the backdrop
 * clears with it. Let go far enough down, or with a flick, and the sheet is
 * asked to close as Escape would: by a `cancel` on its dialog, which the
 * component answers. Otherwise it settles back.
 *
 * It is a gesture on the page, not state: where the sheet is held never
 * reaches a Model. Provide it once, next to the host.
 */
export const DrawerDrag = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      let drag: Drag | undefined

      const release = (held: Drag) => {
        held.dialog.removeAttribute("data-dragging")
        held.panel.style.removeProperty("translate")
        held.backdrop?.style.removeProperty("opacity")
      }

      const onDown = (event: PointerEvent) => {
        if (drag !== undefined || !event.isPrimary || event.button !== 0) return
        const grip = (event.target as Element | null)?.closest?.(".drawer-grip")
        const dialog = grip?.closest<HTMLDialogElement>("dialog.drawer[open]")
        const panel = dialog?.querySelector<HTMLElement>(
          ":scope > .drawer-panel",
        )
        if (dialog == null || panel == null) return
        drag = {
          dialog,
          panel,
          backdrop: dialog.querySelector<HTMLElement>(
            ":scope > .drawer-backdrop",
          ),
          pointerId: event.pointerId,
          startY: event.clientY,
          startAt: event.timeStamp,
          height: panel.getBoundingClientRect().height,
          offset: 0,
        }
      }

      const onMove = (event: PointerEvent) => {
        if (drag === undefined || event.pointerId !== drag.pointerId) return
        const offset = Math.max(0, event.clientY - drag.startY)
        if (offset < slop && !drag.dialog.hasAttribute("data-dragging")) return
        drag.offset = offset
        drag.dialog.setAttribute("data-dragging", "")
        drag.panel.style.setProperty("translate", `0 ${offset}px`)
        drag.backdrop?.style.setProperty(
          "opacity",
          String(1 - Math.min(1, offset / drag.height)),
        )
      }

      const onUp = (event: PointerEvent) => {
        if (drag === undefined || event.pointerId !== drag.pointerId) return
        const held = drag
        drag = undefined
        if (!held.dialog.hasAttribute("data-dragging")) return
        const elapsed = Math.max(1, event.timeStamp - held.startAt)
        const close =
          event.type === "pointerup" &&
          (held.offset > held.height * closeAt ||
            held.offset / elapsed > flickAt)
        if (!close) return release(held)
        // The sheet stays where it was let go until its dialog has closed,
        // then leaves from there. If the component keeps it open, it settles
        // back instead, two frames on.
        const settle = () => release(held)
        held.dialog.addEventListener("close", settle, { once: true })
        requestAnimationFrame(() => requestAnimationFrame(settle))
        held.dialog.dispatchEvent(new Event("cancel", { cancelable: true }))
      }

      document.addEventListener("pointerdown", onDown)
      document.addEventListener("pointermove", onMove)
      document.addEventListener("pointerup", onUp)
      document.addEventListener("pointercancel", onUp)
      return () => {
        document.removeEventListener("pointerdown", onDown)
        document.removeEventListener("pointermove", onMove)
        document.removeEventListener("pointerup", onUp)
        document.removeEventListener("pointercancel", onUp)
        if (drag !== undefined) release(drag)
      }
    }),
    (stop) => Effect.sync(stop),
  ),
)
