import { Effect, Option, Schema, Stream } from "effect"
import { Command, Component, Renderer, Subscription } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { ElementSize } from "../browser/services/ElementSize.ts"
import { Viewport } from "../browser/services/Viewport.ts"

const Props = Schema.Struct({
  /** How many items the list has. */
  count: Schema.Finite,
  /** The height of a row in pixels, used until a row has been measured. */
  estimatedRowSize: Schema.Finite,
  /** How many rows to render on each side of the ones in view. 3 when omitted. */
  overscan: Schema.optional(Schema.Finite),
  /**
   * How many items to render before the list has been measured: enough to
   * fill the first screen. One row and its overscan when omitted.
   */
  initialCount: Schema.optional(Schema.Finite),
  /**
   * A name for the items the list shows, such as the search they answer.
   * Row heights are remembered by row, so the list drops them when the name
   * changes. Leave it out and they are kept.
   */
  dataset: Schema.optional(Schema.String),
})
type Props = typeof Props.Type

const Model = Schema.Struct({
  /** The first and last rows in view, or `null` until the list is measured. */
  visible: Schema.NullOr(
    Schema.Struct({ first: Schema.Finite, last: Schema.Finite }),
  ),
  /** The height of the window. */
  viewport: Schema.Finite,
  /** How many items share a row. */
  lanes: Schema.Finite,
  /** The space between two rows. */
  gap: Schema.Finite,
  /** The width the rows were measured at: their heights don't hold at another. */
  width: Schema.Finite,
  /** The measured height of each row, by row index. */
  sizes: Schema.Record(Schema.String, Schema.Finite),
  /** The `dataset` the rows were measured for. */
  dataset: Schema.NullOr(Schema.String),
  /** The item that has the keyboard focus, or something in it has. */
  focused: Schema.NullOr(Schema.Finite),
})
type Model = typeof Model.Type

/** Items from `start` up to `end`. */
const Range = Schema.Struct({ start: Schema.Finite, end: Schema.Finite })

/** What `Measure` read from the page, in pixels relative to the window. */
const Measurement = Schema.Struct({
  list: Schema.Struct({ top: Schema.Finite, width: Schema.Finite }),
  /** The rendered items, in order. */
  items: Schema.Array(
    Schema.Struct({
      index: Schema.Finite,
      top: Schema.Finite,
      left: Schema.Finite,
      height: Schema.Finite,
    }),
  ),
})
type Measurement = typeof Measurement.Type

const Message = Schema.TaggedUnion({
  /** The window scrolled or changed size, or the list got other items. */
  Moved: { viewport: Schema.Finite },
  /** The box of the list or of a rendered item changed size. */
  Resized: {},
  Measured: Measurement.fields,
  /** The focus went to an item, or to something in it. */
  Focused: { index: Schema.Finite },
  /** The focus left an item, perhaps for another one. */
  Blurred: { index: Schema.Finite },
  /** The focus left an item and no item got it. */
  Unfocused: { index: Schema.Finite },
})

const List = Html.ref("VirtualList.list", "div")
const Item = Html.ref("VirtualList.item", "div")

// ---------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------

const defaultOverscan = 3

// Boxes are fractions of a pixel, and the same box can differ by a rounding
// error from one read to the next.
const same = (a: number, b: number) => Math.abs(a - b) < 0.5

/** The Model without what it learned about the items of another dataset. */
const current = (model: Model, props: Props): Model =>
  props.dataset === undefined || props.dataset === model.dataset
    ? model
    : { ...model, dataset: props.dataset, sizes: {}, focused: null }

interface Layout {
  readonly rows: number
  /**
   * Where each row starts, from the top of the list. It has one more entry
   * than there are rows: where a row after the last one would start.
   */
  readonly offsets: ReadonlyArray<number>
}

const layoutOf = (model: Model, props: Props): Layout => {
  const rows = Math.ceil(props.count / model.lanes)
  const known = Object.values(model.sizes)
  const estimate =
    known.length === 0
      ? props.estimatedRowSize
      : known.reduce((sum, size) => sum + size, 0) / known.length
  const offsets = [0]
  for (let row = 0; row < rows; row++) {
    offsets.push(offsets[row] + (model.sizes[row] ?? estimate) + model.gap)
  }
  return { rows, offsets }
}

/** The row that `y` falls in, counting the gap under a row as part of it. */
const rowAt = (layout: Layout, y: number): number => {
  let low = 0
  let high = layout.rows - 1
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (layout.offsets[middle] <= y) low = middle
    else high = middle - 1
  }
  return low
}

interface Window {
  /**
   * The items to render. There are two ranges when the focused item is away
   * from the window: its rows, and the window's.
   */
  readonly ranges: ReadonlyArray<typeof Range.Type>
  /** The room the rows before and after them take. */
  readonly before: number
  readonly after: number
  /** The room the rows between two ranges take. */
  readonly between: number
}

const windowOf = (model: Model, props: Props): Window => {
  const layout = layoutOf(model, props)
  const overscan = props.overscan ?? defaultOverscan
  let startRow = 0
  let endRow: number
  if (model.visible === null) {
    // Until the list is measured there is no telling what is in view, so the
    // top of the list is rendered, which also gives `Measure` items to read
    endRow =
      props.initialCount === undefined
        ? overscan + 1
        : Math.ceil(props.initialCount / model.lanes)
  } else {
    // The list may have shrunk since it was measured
    const lastRow = layout.rows - 1
    startRow = Math.max(0, Math.min(model.visible.first, lastRow) - overscan)
    endRow = Math.min(model.visible.last, lastRow) + overscan + 1
  }
  endRow = Math.min(layout.rows, endRow)

  const rows = [[startRow, endRow]]
  if (model.focused !== null && model.focused < props.count) {
    // An element that is removed loses the focus, so the focused item stays
    // however far the window goes. The rows next to it stay too: Tab and
    // Shift+Tab then go where they would if every item were rendered.
    const row = Math.floor(model.focused / model.lanes)
    const kept = [Math.max(0, row - 1), Math.min(layout.rows, row + 2)]
    if (kept[1] < startRow) rows.unshift(kept)
    else if (kept[0] > endRow) rows.push(kept)
    else rows[0] = [Math.min(startRow, kept[0]), Math.max(endRow, kept[1])]
  }

  const last = rows[rows.length - 1][1]
  return {
    ranges: rows.map(([start, end]) => ({
      start: start * model.lanes,
      end: Math.min(props.count, end * model.lanes),
    })),
    before: layout.offsets[rows[0][0]],
    // A gap is counted under every row, and the last row has none
    after:
      last === layout.rows
        ? 0
        : layout.offsets[layout.rows] - layout.offsets[last],
    between:
      rows.length === 1
        ? 0
        : layout.offsets[rows[1][0]] - layout.offsets[rows[0][1]],
  }
}

/** How many lanes the items sit in: the number of left edges they have. */
const lanesOf = (items: Measurement["items"]): number => {
  const lefts = items.map((item) => item.left).sort((a, b) => a - b)
  return lefts.filter((left, i) => i === 0 || !same(left, lefts[i - 1])).length
}

/**
 * The Model after a measurement: the same one when it says nothing new, so
 * measuring again after it stops.
 */
const measured = (
  model: Model,
  props: Props,
  { items, list }: Measurement,
): Model => {
  // A list that isn't shown has no boxes to learn from
  if (list.width === 0) return model

  let { gap, lanes } = model
  let changed = !same(list.width, model.width)
  let sizes: Record<string, number> = changed ? {} : { ...model.sizes }

  // Items that fit in the lanes already known may be a last row with room
  // left, which says nothing about the lanes
  const measuredLanes = lanesOf(items)
  const lanesChanged =
    items.length > 0 &&
    measuredLanes !== lanes &&
    (measuredLanes < items.length || measuredLanes > lanes)
  if (lanesChanged) {
    lanes = measuredLanes
    sizes = {}
    changed = true
  }
  // The first row of a second range is pushed down by a margin. When the
  // lanes change, the items were rendered for other rows than the ones they
  // are in now, and a row can hold items with and without the margin: its
  // height says nothing then.
  const apart = items.some(
    (item, i) => i > 0 && item.index !== items[i - 1].index + 1,
  )
  if (!(lanesChanged && apart)) {
    const rows = new Map<
      number,
      {
        top: number
        bottom: number
        minBottom: number
        maxTop: number
        n: number
      }
    >()
    for (const item of items) {
      const index = Math.floor(item.index / lanes)
      const bottom = item.top + item.height
      const row = rows.get(index)
      if (row === undefined) {
        rows.set(index, {
          top: item.top,
          bottom,
          minBottom: bottom,
          maxTop: item.top,
          n: 1,
        })
      } else {
        row.top = Math.min(row.top, item.top)
        row.bottom = Math.max(row.bottom, bottom)
        row.minBottom = Math.min(row.minBottom, bottom)
        row.maxTop = Math.max(row.maxTop, item.top)
        row.n++
      }
    }
    let gapFound = false
    for (const [index, row] of rows) {
      // Only a row with all its items, side by side, has the row's height
      const length = Math.min(lanes, props.count - index * lanes)
      if (row.n !== length || row.maxTop >= row.minBottom) {
        rows.delete(index)
        continue
      }
      const size = row.bottom - row.top
      const known = sizes[index]
      if (known === undefined || !same(known, size)) {
        sizes[index] = size
        changed = true
      }
      const above = rows.get(index - 1)
      if (!gapFound && above !== undefined) {
        gapFound = true
        if (!same(row.top - above.bottom, gap)) {
          gap = row.top - above.bottom
          changed = true
        }
      }
    }
  }

  const next: Model = { ...model, gap, lanes, sizes, width: list.width }
  const layout = layoutOf(next, props)
  const visible =
    layout.rows === 0
      ? null
      : {
          first: rowAt(layout, -list.top),
          last: rowAt(layout, model.viewport - list.top),
        }
  return !changed &&
    visible?.first === model.visible?.first &&
    visible?.last === model.visible?.last
    ? model
    : { ...next, visible }
}

// ---------------------------------------------------------------------------
// commands
// ---------------------------------------------------------------------------

/**
 * Reads the boxes of the list and of the items in `ranges`, once the render
 * that asked for it is committed. It answers with nothing when the list
 * isn't rendered.
 */
const Measure = Command.make(
  "VirtualList.measure",
  { args: { ranges: Schema.Array(Range) } },
  Effect.fnUntraced(function* ({ ranges }) {
    const refs = yield* Renderer.Refs
    const host = yield* Html.Host
    const list = yield* refs.lookup(List)
    if (Option.isNone(list)) return Component.noop
    const { top, width } = host.measure(list.value)
    const items: Array<Measurement["items"][number]> = []
    for (const { end, start } of ranges) {
      for (let index = start; index < end; index++) {
        const item = yield* refs.lookup(Item.at(index))
        if (Option.isNone(item)) continue
        const box = host.measure(item.value)
        items.push({ index, top: box.top, left: box.left, height: box.height })
      }
    }
    return Message.make({ _tag: "Measured", list: { top, width }, items })
  }),
)

const measure = (model: Model, props: Props) =>
  Measure({ ranges: windowOf(model, props).ranges })

/**
 * Follows the size of the list element and of the items rendered in it: one
 * of them changes when a row gets taller or shorter, and when the list gets
 * wider or narrower. The list alone would miss a row that grows as much as
 * another shrinks. It ends at once when the list isn't rendered, and one
 * run following an element is enough, so another run for it ends at once.
 */
export class ObserveSize extends Command.Service<ObserveSize>()(
  "VirtualList.observe",
  { args: {}, stream: true },
  Effect.gen(function* () {
    const size = yield* ElementSize
    const observed = new WeakSet<Element>()
    return () =>
      Renderer.Refs.use((refs) => refs.lookup(List)).pipe(
        Effect.map(
          Option.match({
            onNone: () => Stream.empty,
            onSome: (element) => {
              if (observed.has(element)) return Stream.empty
              observed.add(element)
              return size.changes(element).pipe(
                Stream.map(() => Message.make({ _tag: "Resized" })),
                Stream.ensuring(Effect.sync(() => observed.delete(element))),
              )
            },
          }),
        ),
        Stream.unwrap,
      )
  }),
) {}

/**
 * Answers a moment after the focus left an item. The browser says that it
 * left one item before it says that another got it, and in between the item
 * it is going to must not be removed.
 */
const FocusLeft = Command.make(
  "VirtualList.focusLeft",
  { args: { index: Schema.Finite }, mode: "switch" },
  ({ index }) =>
    Effect.sleep("1 millis").pipe(
      Effect.as(Message.make({ _tag: "Unfocused", index })),
    ),
)

// ---------------------------------------------------------------------------
// component
// ---------------------------------------------------------------------------

/**
 * A list that renders only the items near the window, and leaves room for
 * the others so the page is as tall as the whole list. It scrolls with the
 * page.
 *
 * It is headless. The consumer applies `list` to a `div` around the items
 * and `item` to a `div` for each index in `items`, in order and with nothing
 * between them, and looks up what to draw in each by its index.
 *
 * **The layout it supports**
 *
 * Nothing about the layout is passed in: the component reads it from the
 * boxes of the items it rendered. It takes the list to be rows of items:
 *
 * - Every item takes one cell. Each row has as many items as the others,
 *   but for the last, and the items of a lane have the same left edge.
 * - Rows are as tall as their tallest item and can differ from each other.
 *   A row that hasn't been rendered takes the average of the ones that have.
 * - The space between rows is the list's `gap`, and the same everywhere.
 *
 * A block, a flex column and a CSS grid with equal columns are such lists,
 * and a grid needs no column count: the lanes follow its breakpoints. Items
 * that span cells, masonry and wrapping items of unequal widths are not.
 *
 * The parts set `style` on the list and on some items, for the padding and
 * margin that stand in for the rows left out, so those are the parts'. An
 * item's index changes when items are added before it, so key each item's
 * element by the item's own id.
 *
 * **What it follows**
 *
 * It measures on a scroll and a resize of the window, through `Viewport`,
 * and when the list element or one of its children changes size, through
 * `ElementSize`: that is when a rendered row grows or shrinks. So the items
 * have to be the list element's own children. When `count` or `dataset`
 * changes it measures again. A row keeps the height it was last measured at while
 * it isn't rendered, so one that changed since is corrected when the window
 * comes back to it.
 *
 * A headless component can't provide Layers, so the component that renders
 * the list provides `ObserveSize.layer`.
 *
 * The item that has the keyboard focus stays rendered with the rows next to
 * it, wherever the window is.
 */
export const VirtualList = Component.define({
  name: "VirtualList",
  props: Props,
  model: Model,
  message: Message,
  elements: Html,
}).make({
  init: ($) => ({
    visible: null,
    viewport: 0,
    lanes: 1,
    gap: 0,
    width: 0,
    sizes: {},
    dataset: $.props.dataset ?? null,
    focused: null,
  }),
  update: (stored, message, $) => {
    const model = current(stored, $.props)
    return Message.match(message, {
      Moved: ({ viewport }) => {
        const next =
          viewport === model.viewport ? model : { ...model, viewport }
        return $.set(next).run(measure(next, $.props), ObserveSize.make())
      },
      Resized: () => $.set(model).run(measure(model, $.props)),
      // The new Model renders other rows, at their estimated heights, so
      // they are measured in turn until a measurement changes nothing
      Measured: (measurement) => {
        const next = measured(model, $.props, measurement)
        return next === stored
          ? stored
          : $.set(next).run(measure(next, $.props))
      },
      // The rows next to the focused item may not have been rendered
      Focused: ({ index }) => {
        const next = { ...model, focused: index }
        return $.set(next).run(
          Command.interrupt(FocusLeft),
          measure(next, $.props),
        )
      },
      Blurred: ({ index }) => $.set(model).run(FocusLeft({ index })),
      Unfocused: ({ index }) =>
        model.focused === index ? { ...model, focused: null } : model,
    })
  },
  // Keyed on the count and the dataset, so that a list with other items
  // starts over and gets the current window, which measures what it renders
  subscriptions: (_model, props) => [
    props.count > 0 &&
      Subscription.make(
        "VirtualList.viewport",
        [props.count, props.dataset ?? null],
        () =>
          Stream.unwrap(
            Effect.map(Viewport, (viewport) =>
              viewport.changes.pipe(
                Stream.map(({ height }) =>
                  Message.make({ _tag: "Moved", viewport: height }),
                ),
              ),
            ),
          ),
      ),
  ],
  parts: (stored, p) => {
    const model = current(stored, p.props)
    const { after, before, between, ranges } = windowOf(model, p.props)
    // The first row of a second range, which stands off from the first
    const pushed = ranges.length === 1 ? -1 : ranges[1].start
    return {
      /** The indices of the items to render, in order. */
      items: ranges.flatMap(({ end, start }) =>
        Array.from({ length: end - start }, (_, i) => start + i),
      ),
      list: p.part("div", (b) =>
        b
          .ref(List)
          .attr("role", "list")
          .style({
            paddingTop: `${before}px`,
            paddingBottom: `${after}px`,
          }),
      ),
      // Only some of the items are in the document, so each one says where
      // it is in the whole list
      item: p.part("div", (b, index: number) => {
        const item = b
          .ref(Item.at(index))
          .attr("role", "listitem")
          .attr("aria-posinset", String(index + 1))
          .attr("aria-setsize", String(p.props.count))
          .on("focusin", Message.make({ _tag: "Focused", index }))
          .on("focusout", Message.make({ _tag: "Blurred", index }))
        return index >= pushed && index < pushed + model.lanes
          ? item.style({ marginTop: `${between}px` })
          : item
      }),
    }
  },
})
