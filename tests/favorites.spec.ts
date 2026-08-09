import { expect, test } from "@playwright/test"

const favorite = {
  id: "offline-sync-hammer",
  title: "Offline Sync Hammer",
  url: "https://example.com/offline-sync-hammer",
  images: [
    {
      mime: "image/jpeg",
      sequence: "0",
      thumbnailUrl: "https://example.com/offline-sync-hammer-thumbnail.jpg",
      url: "https://example.com/offline-sync-hammer.jpg",
    },
  ],
  price: 12,
  numberOfReviews: 4,
  rating: 5,
}

test("favorites remain writable while the configured sync remote is unavailable", async ({
  page,
}) => {
  await page.addInitScript(
    ({ favorite }) => {
      localStorage.setItem("favorites", JSON.stringify([favorite]))
      localStorage.setItem(
        "remoteUrl",
        JSON.stringify({
          _tag: "Some",
          value: "ws://127.0.0.1:65535/",
        }),
      )
    },
    { favorite },
  )

  await page.goto("/")

  await expect(page.getByText(favorite.title)).toBeVisible()
  await page.getByRole("button", { name: "Toggle favorite" }).click()

  await expect(page.getByText(favorite.title)).toBeHidden()
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("favorites")))
    .toBe("[]")
})
