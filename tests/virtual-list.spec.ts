import { expect, test, type Page } from "@playwright/test"

const total = 120
const pageSize = 36

const product = (n: number) => ({
  id: `p${n}`,
  title: `Product ${n}`,
  url: `https://example.com/p${n}`,
  images: [
    {
      mime: "image/jpeg",
      sequence: "0",
      thumbnailUrl: "https://example.com/t.jpg",
      url: "https://example.com/i.jpg",
    },
  ],
  price: 20,
  numberOfReviews: 1,
  rating: 4,
})

const fulfillment = {
  _tag: "Some",
  value: {
    fulfillment: {
      addToCartEnabled: true,
      availableInStore: true,
      disableStockVisibility: false,
      driveNCollect: "",
      inStorePickUpData: { inStoreStockMsg: "itemsAvailableInStock", stock: 5 },
      isActive: true,
      isSpecialProduct: false,
      poa: false,
    },
    location: { aisle: "12", bay: "3", sequence: "1" },
  },
}

/**
 * Answers a search with `total` products, a page at a time. Stock levels
 * wait for `release`, as they arrive after the cards do.
 */
async function mockRpc(page: Page) {
  let held: Array<() => void> | null = []
  await page.routeWebSocket(/65531/, (ws) => {
    ws.onMessage((raw) => {
      for (const line of String(raw).split("\n").filter(Boolean)) {
        const msgs = JSON.parse(line)
        for (const msg of Array.isArray(msgs) ? msgs : [msgs]) {
          if (msg._tag === "Ping") {
            ws.send(JSON.stringify({ _tag: "Pong" }))
            continue
          }
          if (msg._tag !== "Request") continue
          const reply = (value: unknown) =>
            ws.send(
              JSON.stringify({
                _tag: "Exit",
                requestId: msg.id,
                exit: { _tag: "Success", value },
              }),
            )
          if (msg.tag === "login") {
            reply({
              id: "s1",
              token: { expires: Date.now() + 86_400_000, token: "t" },
              location: {
                _tag: "Set",
                region: "NI_Zone_1",
                code: "9518",
                city: "Grey Lynn",
                country: "New Zealand",
                state: "NI",
                website: "NZ",
              },
            })
          } else if (msg.tag === "search") {
            const offset: number = msg.payload.offset
            reply({
              totalCount: total,
              facets: [],
              results: Array.from(
                { length: Math.min(pageSize, total - offset) },
                (_, i) => product(offset + i + 1),
              ),
            })
          } else if (msg.tag === "fulfillment") {
            if (held === null) reply(fulfillment)
            else held.push(() => reply(fulfillment))
          }
        }
      }
    })
  })
  return {
    release: () => {
      held?.forEach((send) => send())
      held = null
    },
  }
}

const card = (page: Page, n: number) =>
  page.getByRole("link", { name: new RegExp(`Product ${n}\\b`) })

/** Scrolls down until card `n` is in the document and in view. */
const scrollDownTo = async (page: Page, n: number) => {
  for (let i = 0; i < 60 && !(await card(page, n).isVisible()); i++) {
    await page.mouse.wheel(0, 1000)
    await page.waitForTimeout(100)
  }
  await card(page, n).scrollIntoViewIfNeeded()
}

/** What the list looks like, read from the page as a user would see it. */
const read = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('[role="list"]')!
    const items = Array.from(
      list.querySelectorAll<HTMLElement>('[role="listitem"]'),
    )
    const boxes = items.map((item) => item.getBoundingClientRect())
    const columns = new Set(boxes.map((box) => Math.round(box.left))).size
    const count = Number(items[0].getAttribute("aria-setsize"))
    const rows = Math.ceil(count / columns)
    const rowHeight = Math.max(...boxes.map((box) => box.height))
    const gap = parseFloat(getComputedStyle(list).rowGap)
    const position = (item: HTMLElement) =>
      Number(item.getAttribute("aria-posinset"))
    return {
      cards: items.length,
      columns,
      rowHeight,
      listHeight: list.getBoundingClientRect().height,
      // How tall the list would be with every card in the document
      fullHeight: rows * rowHeight + (rows - 1) * gap,
      // Whether the cards reach both edges of the window, or the list's ends
      covered:
        (boxes[0].top <= 0 || position(items[0]) === 1) &&
        (boxes[boxes.length - 1].bottom >= window.innerHeight ||
          position(items[items.length - 1]) === count),
      scrollY: window.scrollY,
    }
  })

/** Waits for the list to be as tall as its cards would be, all rendered. */
const settled = (page: Page) =>
  expect
    .poll(async () => {
      const now = await read(page)
      return now.covered && Math.abs(now.listHeight - now.fullHeight) < 1
    })
    .toBe(true)

/**
 * No more cards than the rows by the window, three more on each side of
 * them, and the focused card's row with the ones next to it.
 */
const bounded = async (page: Page) => {
  const { cards, columns, rowHeight } = await read(page)
  const inWindow = Math.ceil(page.viewportSize()!.height / rowHeight) + 1
  expect(cards).toBeLessThanOrEqual((inWindow + 6 + 3) * columns)
}

test("a long list of results renders only the cards near the window", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const rpc = await mockRpc(page)
  await page.goto("/?query=hammer")
  await expect(card(page, 1)).toBeVisible()
  await settled(page)
  const before = await read(page)

  // Stock badges make the rendered rows taller without a scroll or resize,
  // and the room left for the other rows follows
  rpc.release()
  await expect(page.getByText("Aisle 12/3").first()).toBeVisible()
  await expect
    .poll(async () => {
      const now = await read(page)
      return (
        now.listHeight - before.listHeight >=
        now.cards * (now.rowHeight - before.rowHeight)
      )
    })
    .toBe(true)
  expect((await read(page)).rowHeight).toBeGreaterThan(before.rowHeight)

  // Every page loads on the way to the last card
  let most = 0
  for (let i = 0; i < 40 && !(await card(page, total).isVisible()); i++) {
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(100)
    const now = await read(page)
    most = Math.max(most, now.cards)
    expect(now.covered).toBe(true)
  }
  await expect(card(page, total)).toBeVisible()
  expect(most).toBeLessThanOrEqual(24)
  await settled(page)

  await card(page, total - 2).click()
  await expect(page).toHaveURL(/\/product\/p118/)
  await page.goBack()
  await expect(card(page, total - 2)).toBeInViewport()

  for (const [width, columns] of [
    [800, 3],
    [1280, 4],
    [390, 2],
  ]) {
    await page.setViewportSize({ width, height: 800 })
    await expect.poll(async () => (await read(page)).columns).toBe(columns)
    await settled(page)
  }
})

test("the focused card keeps the focus when the window leaves it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  const rpc = await mockRpc(page)
  rpc.release()
  await page.goto("/?query=hammer")
  await card(page, 5).focus()
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 1500)
    await page.waitForTimeout(100)
  }
  await expect(card(page, 5)).not.toBeInViewport()
  await expect(card(page, 5)).toBeFocused()
  await bounded(page)

  // Tab goes on from the focused card: past its favourite button to the next
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(card(page, 6)).toBeFocused()
  await expect(card(page, 6)).toBeInViewport()
  await page.keyboard.press("Shift+Tab")
  await page.keyboard.press("Shift+Tab")
  await expect(card(page, 5)).toBeFocused()

  // The columns change under the focused card
  await scrollDownTo(page, 49)
  await card(page, 49).focus()
  await page.setViewportSize({ width: 390, height: 800 })
  await expect.poll(async () => (await read(page)).columns).toBe(2)
  await settled(page)
  await expect(card(page, 49)).toBeFocused()
  await bounded(page)
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await expect(card(page, 50)).toBeFocused()
})

test("rows that trade heights don't leave the window empty", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 800 })
  const rpc = await mockRpc(page)
  rpc.release()
  await page.goto("/?query=hammer")
  await expect(card(page, 1)).toBeVisible()
  // Rows of 300px, but for the one of cards 29 and 30. The browser is kept
  // from scrolling along with a card when the ones above it change, as not
  // every browser does that.
  await page.addStyleTag({
    content: `
      html { overflow-anchor: none }
      [role="listitem"] { height: 300px; overflow: hidden }
      html:not(.traded) [role="listitem"]:is([aria-posinset="29"], [aria-posinset="30"]),
      html.traded [role="listitem"]:is([aria-posinset="5"], [aria-posinset="6"]) {
        height: 2800px;
      }
    `,
  })
  const inView = () =>
    page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[role="listitem"]')).filter(
          (item) => {
            const box = item.getBoundingClientRect()
            return box.bottom > 0 && box.top < window.innerHeight
          },
        ).length,
    )

  // The focused card stays in the document, far above the window
  await card(page, 5).focus()
  await scrollDownTo(page, 29)
  await page.evaluate(() =>
    scrollBy(
      0,
      document.querySelector('[aria-posinset="29"]')!.getBoundingClientRect()
        .top,
    ),
  )
  await expect.poll(inView).toBeGreaterThan(0)
  await page.waitForTimeout(300)
  const before = await read(page)

  // One row gets as much taller as another gets shorter, so the list is as
  // tall as it was
  await page.evaluate(() => document.documentElement.classList.add("traded"))
  await expect.poll(inView).toBeGreaterThan(0)
  const after = await read(page)
  expect(after.listHeight).toBe(before.listHeight)
  // A row above the window grew, and the list scrolled by as much, so what
  // was in view stays in place
  expect(after.scrollY - before.scrollY).toBe(2500)
})
