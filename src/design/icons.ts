import { Html } from "@effect/ui/html"
import type { H } from "./h"

type Shape = readonly [tag: string, attrs: Readonly<Record<string, string>>]

// The Lucide icons the app uses, as their SVG shapes.
const shapes = {
  loaderCircle: [["path", { d: "M21 12a9 9 0 1 1-6.219-8.56" }]],
  search: [
    ["path", { d: "m21 21-4.34-4.34" }],
    ["circle", { cx: "11", cy: "11", r: "8" }],
  ],
  settings2: [
    ["path", { d: "M14 17H5" }],
    ["path", { d: "M19 7h-9" }],
    ["circle", { cx: "17", cy: "17", r: "3" }],
    ["circle", { cx: "7", cy: "7", r: "3" }],
  ],
  mapPin: [
    [
      "path",
      {
        d: "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0",
      },
    ],
    ["circle", { cx: "12", cy: "10", r: "3" }],
  ],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  copy: [
    ["rect", { width: "14", height: "14", x: "8", y: "8", rx: "2", ry: "2" }],
    ["path", { d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" }],
  ],
  triangleAlert: [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
      },
    ],
    ["path", { d: "M12 9v4" }],
    ["path", { d: "M12 17h.01" }],
  ],
  arrowLeft: [
    ["path", { d: "m12 19-7-7 7-7" }],
    ["path", { d: "M19 12H5" }],
  ],
  arrowRight: [
    ["path", { d: "M5 12h14" }],
    ["path", { d: "m12 5 7 7-7 7" }],
  ],
  share: [
    ["path", { d: "M12 2v13" }],
    ["path", { d: "m16 6-4-4-4 4" }],
    ["path", { d: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" }],
  ],
  star: [
    [
      "path",
      {
        d: "M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z",
      },
    ],
  ],
  starHalf: [
    [
      "path",
      {
        d: "M12 18.338a2.1 2.1 0 0 0-.987.244L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.12 2.12 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.12 2.12 0 0 0 1.597-1.16l2.309-4.679A.53.53 0 0 1 12 2",
      },
    ],
  ],
  house: [
    ["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" }],
    [
      "path",
      {
        d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      },
    ],
  ],
  arrowUp: [
    ["path", { d: "m5 12 7-7 7 7" }],
    ["path", { d: "M12 19V5" }],
  ],
  searchX: [
    ["path", { d: "m13.5 8.5-5 5" }],
    ["path", { d: "m8.5 8.5 5 5" }],
    ["circle", { cx: "11", cy: "11", r: "8" }],
    ["path", { d: "m21 21-4.3-4.3" }],
  ],
  chevronDown: [["path", { d: "m6 9 6 6 6-6" }]],
} satisfies Record<string, ReadonlyArray<Shape>>

export type IconName = keyof typeof shapes

/**
 * An icon, drawn with the current text colour. Decorative: it has no name.
 * `key` keeps its node when it moves among siblings.
 */
export const icon = <Msg>(
  h: H<Msg>,
  name: IconName,
  options?: {
    readonly class?: string
    readonly strokeWidth?: number
    readonly key?: string | undefined
  },
) => {
  const svg = h.el("svg")
  return (options?.key === undefined ? svg : svg.key(options.key))
    .attr("xmlns", "http://www.w3.org/2000/svg")
    .attr("width", "24")
    .attr("height", "24")
    .attr("viewBox", "0 0 24 24")
    .attr("fill", "none")
    .attr("stroke", "currentColor")
    .attr("stroke-width", String(options?.strokeWidth ?? 2))
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round")
    .attr("aria-hidden", "true")
    .attr("class", Html.classNames("lucide", options?.class))
    .children(
      (shapes[name] as ReadonlyArray<Shape>).map(([tag, attrs]) =>
        Object.entries(attrs).reduce(
          (shape, [key, value]) => shape.attr(key, value),
          h.el(tag),
        ),
      ),
    )
}
