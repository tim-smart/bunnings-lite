import { Effect, Layer } from "effect"

/**
 * Keeps `--scrollbar-width` on the root element at the width the page's
 * scrollbar takes from the layout: nothing where scrollbars overlay the page,
 * or when the page is too short to scroll.
 *
 * An open drawer hides the scrollbar to stop the page scrolling, and
 * `index.css` pads the page by this much so that nothing behind it moves.
 * CSS can't tell how wide the scrollbar was once it is gone. Provide it once,
 * next to the host.
 */
export const ScrollbarWidth = Layer.effectDiscard(
  Effect.acquireRelease(
    Effect.sync(() => {
      const root = document.documentElement
      const measure = () => {
        // Hidden, as behind a drawer: what it measured before still stands
        if (getComputedStyle(root).overflowY === "hidden") return
        root.style.setProperty(
          "--scrollbar-width",
          `${Math.max(0, window.innerWidth - root.clientWidth)}px`,
        )
      }
      // The root's width changes whenever the scrollbar comes or goes
      const observer = new ResizeObserver(measure)
      observer.observe(root)
      return observer
    }),
    (observer) => Effect.sync(() => observer.disconnect()),
  ),
)
