import { expect, test, type Page } from "@playwright/test"

// The sync settings are the drawer that needs nothing from the server.

interface Frame {
  readonly panelTop: number
  readonly panelOpacity: number
  readonly backdropTop: number
  readonly backdropOpacity: number
}

/**
 * Where the drawer's panel and backdrop are on each frame of the next
 * `ms`, for as long as the drawer is on the screen, and on until it has
 * shown and its transitions end: a slow machine can start them late. Start
 * it, act, then await it.
 */
const frames = (page: Page, ms = 900) =>
  page.evaluate(
    (ms) =>
      new Promise<Array<Frame>>((resolve) => {
        const seen: Array<Frame> = []
        const start = performance.now()
        const tick = () => {
          const dialog = document.querySelector("dialog")
          if (dialog !== null) {
            const backdrop = dialog.querySelector(".drawer-backdrop")!
            const panel = dialog.querySelector(".drawer-popup")!
            seen.push({
              panelTop: Math.round(panel.getBoundingClientRect().top),
              panelOpacity: Number(getComputedStyle(panel).opacity),
              backdropTop: Math.round(backdrop.getBoundingClientRect().top),
              backdropOpacity: Number(getComputedStyle(backdrop).opacity),
            })
          }
          const elapsed = performance.now() - start
          const moving =
            dialog !== null &&
            dialog.getAnimations({ subtree: true }).length > 0
          const waiting = seen.length === 0 || moving
          if (elapsed < ms || (waiting && elapsed < 5000)) {
            requestAnimationFrame(tick)
          } else resolve(seen)
        }
        requestAnimationFrame(tick)
      }),
    ms,
  )

const settled = (page: Page) =>
  expect
    .poll(() =>
      page.evaluate(
        () =>
          document.querySelector("dialog")?.getAnimations({ subtree: true })
            .length ?? 0,
      ),
    )
    .toBe(0)

const panelTop = (page: Page) =>
  page.evaluate(() =>
    Math.round(
      document.querySelector(".drawer-popup")!.getBoundingClientRect().top,
    ),
  )

const rising = (values: ReadonlyArray<number>) =>
  values.every((value, i) => i === 0 || value >= values[i - 1]!)
const falling = (values: ReadonlyArray<number>) =>
  values.every((value, i) => i === 0 || value <= values[i - 1]!)

async function openSettings(page: Page, by: "mouse" | "keyboard" = "mouse") {
  await page.goto("/")
  const trigger = page.getByRole("button", { name: "Sync settings" })
  const recording = frames(page)
  if (by === "mouse") await trigger.click()
  else {
    await trigger.focus()
    await page.keyboard.press("Enter")
  }
  const drawer = page.getByRole("dialog", { name: "Sync settings" })
  // The dialog is an empty box in the top layer, around the sheet
  const sheet = drawer.locator(".drawer-popup")
  await expect(sheet).toBeVisible()
  const opening = await recording
  await settled(page)
  return { trigger, drawer, sheet, opening }
}

test("drawer: slides up from the bottom while its backdrop fades in place", async ({
  page,
}) => {
  const { opening } = await openSettings(page)
  const rest = await panelTop(page)
  const tops = opening.map((frame) => frame.panelTop)

  // It starts below where it rests, and only ever moves up
  expect(tops[0]! - rest).toBeGreaterThan(100)
  expect(falling(tops)).toBe(true)
  expect(tops.at(-1)).toBe(rest)

  // The backdrop never moves. It only gets darker.
  expect(opening.every((frame) => frame.backdropTop === 0)).toBe(true)
  const dimming = opening.map((frame) => frame.backdropOpacity)
  expect(dimming[0]).toBeLessThan(0.5)
  expect(rising(dimming)).toBe(true)
  expect(dimming.at(-1)).toBe(1)
})

test("drawer: slides away when it is closed, and gives the page back at once", async ({
  page,
}) => {
  const { trigger, drawer } = await openSettings(page, "keyboard")
  // Focus starts on Remote URL, or on Close when the sheet opened before
  // the fields loaded
  await drawer.getByLabel("Remote URL").focus()
  const rest = await panelTop(page)
  const leaving = page.locator(".drawer-popup[data-ending-style]")
  const search = page.getByRole("searchbox", { name: "Search for products" })

  const recording = frames(page)
  await page.keyboard.press("Escape")
  // The page takes presses, scrolls and has focus back while the sheet is
  // still leaving, and a Tab then moves on through the page
  await expect(leaving).toHaveCount(1)
  await expect(page.locator("main")).not.toHaveAttribute("aria-hidden")
  await expect(trigger).toBeFocused()
  await page.keyboard.press("Tab")
  await expect(search).toBeFocused()
  await expect(leaving).toHaveCount(1)
  const closing = await recording

  const tops = closing.map((frame) => frame.panelTop)
  expect(tops.at(-1)! - rest).toBeGreaterThan(100)
  expect(rising(tops)).toBe(true)
  expect(rising(closing.map((frame) => -frame.backdropOpacity))).toBe(true)
  // Where the Tab left it, once the sheet has gone
  await expect(page.locator("dialog")).toHaveCount(0)
  await expect(search).toBeFocused()
})

test("drawer: opened again while it slides away, it stays open", async ({
  page,
}) => {
  const { trigger, drawer, sheet } = await openSettings(page)
  const rest = await panelTop(page)

  await page.keyboard.press("Escape")
  await expect(page.locator(".drawer-popup[data-ending-style]")).toHaveCount(1)
  await trigger.click()
  // Past when the closed drawer would have been unmounted
  await page.waitForTimeout(700)

  await expect(sheet).toBeVisible()
  await expect(drawer.locator(":focus")).toHaveCount(1)
  await settled(page)
  expect(await panelTop(page)).toBe(rest)
})

test("drawer: on a short screen its controls scroll into view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 400 })
  const { drawer } = await openSettings(page)

  // Focus starts on the first control, and the last is below what fits
  const first = drawer.getByLabel("Remote URL")
  const close = drawer.getByRole("button", { name: "Close" })
  await expect(first).toBeFocused()
  await expect(first).toBeInViewport({ ratio: 1 })
  await expect(close).not.toBeInViewport()

  await close.focus()
  await expect(close).toBeInViewport({ ratio: 1 })
})

test("drawer: the page behind doesn't scroll", async ({ page }) => {
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      document.body.style.minHeight = "300vh"
    })
  })
  await openSettings(page)

  await page.mouse.move(40, 40)
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => scrollY)).toBe(0)

  await page.keyboard.press("Escape")
  await expect(page.locator("dialog")).toHaveCount(0)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0)
})

test("drawer: dragging its handle down closes it, and a short drag settles back", async ({
  page,
}) => {
  const { sheet } = await openSettings(page)
  const rest = await panelTop(page)
  const x = page.viewportSize()!.width / 2
  const y = rest + 12

  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 40, { steps: 4 })
  // It follows the pointer, once the drag is past the slop of a press
  await expect.poll(() => panelTop(page)).toBeGreaterThan(rest + 20)
  expect(await panelTop(page)).toBeLessThanOrEqual(rest + 40)
  // Held there, so that letting go isn't the end of a flick
  await page.waitForTimeout(300)
  await page.mouse.up()
  await expect.poll(() => panelTop(page)).toBe(rest)
  await expect(sheet).toBeVisible()

  // Past half its height closes it, however slowly it was dragged
  const height = (await sheet.boundingBox())!.height
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + height * 0.6, { steps: 10 })
  await page.waitForTimeout(300)
  await page.mouse.up()
  await expect(page.locator("dialog")).toHaveCount(0)
})

test("drawer: fades without moving when motion is reduced", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  const { opening } = await openSettings(page)
  const rest = await panelTop(page)

  expect(opening.every((frame) => frame.panelTop === rest)).toBe(true)
  const appearing = opening.map((frame) => frame.panelOpacity)
  expect(appearing[0]).toBeLessThan(1)
  expect(rising(appearing)).toBe(true)
  expect(appearing.at(-1)).toBe(1)

  const recording = frames(page)
  await page.keyboard.press("Escape")
  const closing = await recording
  expect(closing.every((frame) => frame.panelTop === rest)).toBe(true)
  await expect(page.locator("dialog")).toHaveCount(0)
})
