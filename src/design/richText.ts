import type { View } from "@effect/ui"
import type { RichNode } from "../product/domain/RichText.ts"

/** Renders parsed rich text. Links open in a new tab. */
export const RichText = <Msg>(
  h: View.H<Msg>,
  nodes: ReadonlyArray<RichNode>,
): Array<View.Content<Msg, never> | string> =>
  nodes.map((node) => {
    if (node.type === "text") return node.text
    const children = RichText(h, node.children)
    if (node.tag === "a") {
      return node.href === undefined
        ? h.span(...children)
        : h.a
            .attr("href", node.href)
            .attr("target", "_blank")
            .attr("rel", "noopener noreferrer nofollow")
            .children(...children)
    }
    return h.el(node.tag).children(...children)
  })
