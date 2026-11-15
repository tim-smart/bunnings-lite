import "@effect/ui/html/register"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Schema, Stream, SubscriptionRef } from "effect"
import { TestClock } from "effect/testing"
import { Component } from "@effect/ui"
import { Html } from "@effect/ui/html"
import { Query, TestHost } from "@effect/ui/testing"
import { ElementSize } from "../browser/services/ElementSize.ts"
import { Viewport } from "../browser/services/Viewport.ts"
import { ObserveSize, VirtualList } from "./VirtualList.ts"

// The list is tested as a page has it: a component draws it, and a browser
// lays it out. The browser here is a grid of equal columns that honours the
// padding and margins the list sets, so what a test reads is where the items
// really are, not what the list thinks.

const Items = Schema.Struct({
  count: Schema.Finite,
  dataset: Schema.optional(Schema.String),
})
const Message = Schema.TaggedUnion({ Changed: Items.fields })

const Page = Component.define({
  name: "Page",
  props: Items,
  model: Items,
  message: Message,
})
  .make({
    init: ($) => $.props,
    update: (_model, { count, dataset }) => ({ count, dataset }),
    view: (model, h) =>
      h.child(VirtualList, {
        key: "list",
        props: { ...model, estimatedRowSize: 100 },
        view: (list) =>
          list
            .list(h.div)
            .children(
              list.items.map((index) =>
                list.item(h.div.key(String(index)), index),
              ),
            ),
      }),
  })
  .pipe(Component.provide(ObserveSize.layer))

interface Browser {
  /** How many columns the grid has. */
  lanes: number
  gap: number
  /** The height of the window. */
  height: number
  scrollY: number
  /** The height of the items of a row. */
  rowHeight: (row: number) => number
}

const pixels = (element: TestHost.TestElement, property: string) =>
  Number(
    new RegExp(`${property}:([\\d.]+)px`).exec(
      element.attrs.style ?? "",
    )?.[1] ?? 0,
  )

const position = (item: TestHost.TestElement) =>
  Number(item.attrs["aria-posinset"])

/** Where the grid puts the list's items: their tops from the top of the page. */
const layout = (browser: Browser, list: TestHost.TestElement) => {
  const items = list.children as Array<TestHost.TestElement>
  const tops = new Map<TestHost.TestElement, number>()
  const height = (item: TestHost.TestElement) =>
    browser.rowHeight(Math.floor((position(item) - 1) / browser.lanes))
  let y = pixels(list, "padding-top")
  for (let i = 0; i < items.length; i += browser.lanes) {
    const row = items.slice(i, i + browser.lanes)
    for (const item of row) tops.set(item, y + pixels(item, "margin-top"))
    y +=
      Math.max(
        ...row.map((item) => pixels(item, "margin-top") + height(item)),
      ) + browser.gap
  }
  return {
    tops,
    height,
    listHeight:
      y - (items.length > 0 ? browser.gap : 0) + pixels(list, "padding-bottom"),
  }
}

/** Mounts a page with the list in `browser`, and gives what a user could do. */
const open = Effect.fnUntraced(function* (
  browser: Browser,
  items: typeof Items.Type,
) {
  const moved = yield* SubscriptionRef.make(0)
  const resized = yield* SubscriptionRef.make(0)
  let list: TestHost.TestElement | undefined
  const rect = (top: number, left: number, width: number, height: number) => ({
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  })
  const root = yield* TestHost.mount(Page, items).pipe(
    Effect.provide([
      Layer.succeed(Html.Host, {
        focus: () => {},
        blur: () => {},
        scrollIntoView: () => {},
        measure: (element) => {
          const node = element as unknown as TestHost.TestElement
          if (node === list) {
            return rect(-browser.scrollY, 0, browser.lanes * 100, 0)
          }
          const { height, tops } = layout(browser, list!)
          return rect(
            tops.get(node)! - browser.scrollY,
            ((list!.children as Array<unknown>).indexOf(node) % browser.lanes) *
              100,
            100,
            height(node),
          )
        },
      }),
      Layer.succeed(Viewport, {
        changes: SubscriptionRef.changes(moved).pipe(
          Stream.map(() => ({
            scrollY: browser.scrollY,
            height: browser.height,
            pageHeight: 0,
          })),
        ),
      }),
      Layer.succeed(ElementSize, {
        changes: () =>
          Stream.map(SubscriptionRef.changes(resized), () => undefined),
      }),
    ]),
  )
  list = root.get(Query.attr("role", "list")) as TestHost.TestElement
  yield* TestHost.settle
  const item = (n: number) =>
    root.get(Query.attr("aria-posinset", String(n))) as TestHost.TestElement
  return {
    /** Scrolls the window, as far as the page goes. */
    scrollTo: (y: number) =>
      Effect.gen(function* () {
        browser.scrollY = y
        yield* SubscriptionRef.update(moved, (n) => n + 1)
        yield* TestHost.settle
      }),
    /** The list element changed size: do it after changing the browser. */
    resized: Effect.andThen(
      SubscriptionRef.update(resized, (n) => n + 1),
      TestHost.settle,
    ),
    show: (next: typeof Items.Type) =>
      Effect.gen(function* () {
        root.send(Message.make({ _tag: "Changed", ...next }))
        yield* TestHost.settle
      }),
    fire: (n: number, event: "focusin" | "focusout") =>
      Effect.gen(function* () {
        Query.fire(item(n), event)
        yield* TestHost.settle
      }),
    /** The items in the document, such as "1-9" or "2-4 48-59". */
    rendered: () => {
      const positions = (list!.children as Array<TestHost.TestElement>).map(
        position,
      )
      return positions
        .filter((n, i) => n !== positions[i - 1] + 1)
        .map((first) => {
          let last = first
          while (positions.includes(last + 1)) last++
          return `${first}-${last}`
        })
        .join(" ")
    },
    /** How far down the page item `n` is. */
    top: (n: number) => layout(browser, list!).tops.get(item(n)),
    /** How tall the list is, with the room it leaves for the other items. */
    listHeight: () => layout(browser, list!).listHeight,
  }
})

const browser = (options?: Partial<Browser>): Browser => ({
  lanes: 1,
  gap: 0,
  height: 500,
  scrollY: 0,
  rowHeight: () => 100,
  ...options,
})

it.layer(TestHost.layer(), { buildPerTest: true })("VirtualList", (it) => {
  describe("renders the rows around the window where they belong", () => {
    // 100 rows of 100px in a window of 500px, with 3 rows of overscan
    for (const [scrollY, rendered, first] of [
      [0, "1-9", 1],
      [2000, "18-29", 18],
      [2050, "18-29", 18],
      [9500, "93-100", 93],
    ] as const) {
      it.effect(`scrolled to ${scrollY}`, () =>
        Effect.gen(function* () {
          const page = yield* open(browser(), { count: 100 })
          yield* page.scrollTo(scrollY)
          assert.strictEqual(page.rendered(), rendered)
          assert.strictEqual(page.top(first), (first - 1) * 100)
          assert.strictEqual(page.listHeight(), 10_000)
        }),
      )
    }
  })

  it.effect(
    "gives the rows it hasn't seen the average height of the others",
    () =>
      Effect.gen(function* () {
        const page = yield* open(
          browser({
            height: 400,
            rowHeight: (row) => (row % 2 === 0 ? 100 : 300),
          }),
          { count: 20 },
        )
        // Three pairs of rows are rendered, 400px a pair, and 14 rows are not
        assert.strictEqual(page.rendered(), "1-6")
        assert.strictEqual(page.listHeight(), 1200 + 14 * 200)
        // Once it gets to them it knows better
        yield* page.scrollTo(3600)
        assert.strictEqual(page.top(20), 3700)
        assert.strictEqual(page.listHeight(), 4000)
      }),
  )

  it.effect("follows the columns of a grid, and rows that get taller", () =>
    Effect.gen(function* () {
      const grid = browser({ lanes: 4, gap: 10 })
      const page = yield* open(grid, { count: 100 })
      // 25 rows, 110px apart
      assert.strictEqual(page.rendered(), "1-32")
      assert.strictEqual(page.listHeight(), 25 * 110 - 10)

      // The rows get taller without a scroll, as when their images load
      grid.rowHeight = () => 150
      yield* page.resized
      assert.strictEqual(page.rendered(), "1-28")
      // Close to 25 rows 160px apart: a row that was measured before it grew
      // and isn't rendered now is still taken to be 100px
      assert.closeTo(page.listHeight(), 25 * 160 - 10, 150)

      yield* page.scrollTo(1100)
      assert.strictEqual(page.rendered(), "13-56")
      assert.strictEqual(page.top(13), 3 * 160)

      // A narrower window has two columns: 50 rows
      grid.lanes = 2
      yield* page.resized
      assert.strictEqual(page.rendered(), "7-28")
      assert.strictEqual(page.top(7), 3 * 160)
      assert.strictEqual(page.listHeight(), 50 * 160 - 10)
    }),
  )

  it.effect("starts over for other items, and for fewer", () =>
    Effect.gen(function* () {
      const tall = browser()
      const page = yield* open(tall, { count: 100, dataset: "hammers" })
      // Measures rows 18 to 29 at 100px, then leaves them
      yield* page.scrollTo(2000)
      yield* page.scrollTo(0)

      // As many drills, three times as tall
      tall.rowHeight = () => 300
      yield* page.show({ count: 100, dataset: "drills" })
      assert.strictEqual(page.rendered(), "1-5")
      assert.strictEqual(page.listHeight(), 30_000)

      // The list ends before the rows that were in view
      yield* page.scrollTo(27_000)
      yield* page.show({ count: 10, dataset: "drills" })
      assert.strictEqual(page.rendered(), "7-10")
      assert.strictEqual(page.top(7), 1800)
      assert.strictEqual(page.listHeight(), 3000)
    }),
  )

  it.effect(
    "keeps the focused item and its neighbours while the window is away",
    () =>
      Effect.gen(function* () {
        const page = yield* open(browser(), { count: 100 })
        yield* page.fire(3, "focusin")
        yield* page.scrollTo(5000)
        assert.strictEqual(page.rendered(), "2-4 48-59")
        assert.strictEqual(page.top(3), 200)
        assert.strictEqual(page.top(48), 4700)
        assert.strictEqual(page.listHeight(), 10_000)

        // Tab: the browser says the focus left 3 before it says 4 has it
        yield* page.fire(3, "focusout")
        yield* page.fire(4, "focusin")
        yield* TestClock.adjust("1 second")
        assert.strictEqual(page.rendered(), "3-5 48-59")

        // The focus leaves the list
        yield* page.fire(4, "focusout")
        yield* TestClock.adjust("1 second")
        assert.strictEqual(page.rendered(), "48-59")
        assert.strictEqual(page.top(48), 4700)
      }),
  )
})
