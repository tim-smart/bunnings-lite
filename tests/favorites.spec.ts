import { expect, test } from "@playwright/test"

const favorite = {
  id: "test-hammer",
  title: "Test Hammer",
  url: "https://example.com/test-hammer",
  images: [
    {
      mime: "image/jpeg",
      sequence: "0",
      thumbnailUrl: "https://example.com/test-hammer-thumbnail.jpg",
      url: "https://example.com/test-hammer.jpg",
    },
  ],
  price: 12,
  numberOfReviews: 4,
  rating: 5,
}

test("a keyboard user can remove a favourite", async ({ page }) => {
  await page.addInitScript((product) => {
    localStorage.setItem("favorites", JSON.stringify([product]))
  }, favorite)
  await page.goto("/")

  const toggle = page.getByRole("button", { name: "Toggle favorite" })
  await expect(toggle).toBeVisible()

  await toggle.focus()
  await page.keyboard.press("Enter")

  await expect(toggle).toBeHidden()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("favorites")))
    .toBe("[]")
})
