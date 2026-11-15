import { expect, test } from "@playwright/test"

// Scrollbars that take room from the page, as on Windows and Linux. Playwright
// hides them by default, and the browser is launched once for a whole file.
test.use({
  launchOptions: async ({ launchOptions }, use) => {
    await use({
      ...launchOptions,
      ignoreDefaultArgs: ["--hide-scrollbars"],
      args: ["--disable-features=OverlayScrollbar"],
    })
  },
})

test("drawer: nothing behind it moves when the page's scrollbar is hidden", async ({
  page,
}) => {
  await page.addInitScript(() => {
    addEventListener("DOMContentLoaded", () => {
      document.body.style.minHeight = "300vh"
    })
  })
  await page.goto("/")
  const trigger = page.getByRole("button", { name: "Sync settings" })
  await expect(trigger).toBeVisible()

  // The button in the page, and what is fixed to the screen's right edge
  const edges = () =>
    page.evaluate(() => {
      const fixed = Array.from(document.querySelectorAll("#root *")).find(
        (element) =>
          element.localName !== "dialog" &&
          getComputedStyle(element).position === "fixed",
      )!
      return {
        trigger: document
          .querySelector('[aria-label="Sync settings"]')!
          .getBoundingClientRect().left,
        fixed: fixed.getBoundingClientRect().right,
      }
    })
  const scrollbar = () =>
    page.evaluate(() => innerWidth - document.documentElement.clientWidth)

  expect(await scrollbar()).toBeGreaterThan(0)
  const before = await edges()

  await trigger.click()
  const drawer = page.getByRole("dialog", { name: "Sync settings" })
  await expect(drawer).toBeVisible()
  expect(await scrollbar()).toBe(0)
  expect(await edges()).toEqual(before)

  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()
  expect(await scrollbar()).toBeGreaterThan(0)
  expect(await edges()).toEqual(before)
})
