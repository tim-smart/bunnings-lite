import { expect, test, type Locator, type Page } from "@playwright/test"

const product = (id: string, title: string) => ({
  id,
  title,
  url: `https://example.com/${id}`,
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

const fulfillment = (inStock: boolean, aisle: string, bay: string) => ({
  _tag: "Some",
  value: {
    fulfillment: {
      addToCartEnabled: true,
      availableInStore: true,
      disableStockVisibility: false,
      driveNCollect: "",
      inStorePickUpData: {
        inStoreStockMsg: inStock ? "itemsAvailableInStock" : "outOfStock",
        stock: inStock ? 5 : 0,
      },
      isActive: true,
      isSpecialProduct: false,
      poa: false,
    },
    location: { aisle, bay, sequence: "1" },
  },
})

const results = {
  "1": { title: "Cordless drill", fulfillment: fulfillment(false, "1", "1") },
  "2": { title: "Claw hammer", fulfillment: fulfillment(true, "120", "14") },
}

async function mockRpc(page: Page) {
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
          let value: unknown
          if (msg.tag === "login") {
            value = {
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
            }
          } else if (msg.tag === "search") {
            value = {
              totalCount: 2,
              facets: [],
              results: Object.entries(results).map(([id, { title }]) =>
                product(id, title),
              ),
            }
          } else if (msg.tag === "fulfillment") {
            value = results[msg.payload.id as keyof typeof results].fulfillment
          } else {
            continue
          }
          ws.send(
            JSON.stringify({
              _tag: "Exit",
              requestId: msg.id,
              exit: { _tag: "Success", value },
            }),
          )
        }
      }
    })
  })
}

const box = async (locator: Locator) => {
  const b = await locator.boundingBox()
  expect(b).not.toBeNull()
  return b!
}

test.use({ viewport: { width: 320, height: 800 } })

test("product card: badges leave the favourite button full size on narrow cards", async ({
  page,
}) => {
  await mockRpc(page)
  await page.goto("/?query=drill")

  for (const [title, badgeText] of [
    ["Cordless drill", "Out of stock"],
    ["Claw hammer", "Aisle 120/14"],
  ]) {
    const card = page.locator("a", { hasText: title })
    const badge = card.getByText(badgeText, { exact: true })
    await expect(badge).toBeVisible({ timeout: 10_000 })

    const favorite = await box(
      card.getByRole("button", { name: "Toggle favorite" }),
    )
    expect(favorite.width).toBeGreaterThanOrEqual(36)
    expect(favorite.height).toBeGreaterThanOrEqual(36)

    // The badge stays whole, inside the card, and clear of the button
    const cardBox = await box(card)
    const badgeBox = await box(badge)
    expect(badgeBox.x).toBeGreaterThanOrEqual(cardBox.x)
    expect(badgeBox.x + badgeBox.width).toBeLessThanOrEqual(
      cardBox.x + cardBox.width,
    )
    expect(await badge.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
      true,
    )
    const overlaps =
      badgeBox.x < favorite.x + favorite.width &&
      favorite.x < badgeBox.x + badgeBox.width &&
      badgeBox.y < favorite.y + favorite.height &&
      favorite.y < badgeBox.y + badgeBox.height
    expect(overlaps).toBe(false)
  }
})
