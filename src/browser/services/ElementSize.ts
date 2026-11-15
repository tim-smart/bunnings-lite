import { Context, Effect, Layer, Queue, Stream } from "effect"

/**
 * The size of an element and of the elements in it, so a component can
 * follow them from a Command and a test can drive them.
 */
export class ElementSize extends Context.Service<
  ElementSize,
  {
    /**
     * Emits once when it starts, then each time the content box of the
     * element or the border box of one of its children changes size. The
     * children are the ones it has at the time. Changes in the same frame
     * are one change.
     */
    readonly changes: (element: Element) => Stream.Stream<void>
  }
>()("browser/ElementSize") {
  static readonly layer = Layer.sync(ElementSize, () => ({
    changes: (element) =>
      Stream.callback<void>(
        (queue) =>
          Effect.acquireRelease(
            Effect.sync(() => {
              // One observer for every box: it reports them together
              const sizes = new ResizeObserver(() => {
                Queue.offerUnsafe(queue, undefined)
              })
              const watch = (child: Element) =>
                sizes.observe(child, { box: "border-box" })
              const children = new MutationObserver((records) => {
                for (const record of records) {
                  for (const node of record.removedNodes) {
                    if (node instanceof Element) sizes.unobserve(node)
                  }
                  for (const node of record.addedNodes) {
                    if (node instanceof Element) watch(node)
                  }
                }
              })
              sizes.observe(element)
              children.observe(element, { childList: true })
              for (const child of element.children) watch(child)
              return () => {
                children.disconnect()
                sizes.disconnect()
              }
            }),
            (disconnect) => Effect.sync(disconnect),
          ),
        // Changes that weren't read yet are one change
        { bufferSize: 1, strategy: "sliding" },
      ),
  }))
}
