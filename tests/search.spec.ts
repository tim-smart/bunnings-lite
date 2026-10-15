import { expect, test, type Page } from "@playwright/test"

type SearchCall = {
  query: string
  offset: number
  price: [number, number] | null
  rating: [number, number] | null
}

type EncodedRange = { _tag: "None" } | { _tag: "Some"; value: [number, number] }

const optValue = (option: EncodedRange) =>
  option._tag === "Some" ? option.value : null

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

async function mockRpc(page: Page) {
  const searches: Array<SearchCall> = []
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
                _tag: "Unset",
                country: "New Zealand",
                website: "NZ",
                code: "9489",
                region: "NI_Zone_9",
                state: "NI",
              },
            }
          } else if (msg.tag === "search") {
            const p = msg.payload
            const price = optValue(p.priceRange)
            searches.push({
              query: p.query,
              offset: p.offset,
              price,
              rating: optValue(p.ratingRange),
            })
            const label = price ? `$${price[0]}-$${price[1]}` : "all prices"
            value = {
              totalCount: 1,
              facets: [
                {
                  facetId: "@price",
                  values: [{ start: 0, end: 500, endInclusive: true }],
                },
              ],
              results: [
                product(`${p.query}-${label}`, `${p.query} / ${label}`),
              ],
            }
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
  return searches
}

test("search: initial URL query, filter change, query change resets filter", async ({
  page,
}) => {
  const searches = await mockRpc(page)
  await page.goto("/?query=hammer")

  await expect(
    page.getByText("hammer / all prices", { exact: true }),
  ).toBeVisible({
    timeout: 10_000,
  })
  expect(searches).toContainEqual({
    query: "hammer",
    offset: 0,
    price: null,
    rating: null,
  })
  expect(
    searches.filter((s) => s.query === "hammer").every((s) => s.price === null),
  ).toBe(true)

  const [minInput, maxInput] = [
    page.getByPlaceholder("$0"),
    page.getByPlaceholder("$500"),
  ]
  await minInput.fill("10")
  await maxInput.fill("50")
  await maxInput.press("Enter")
  await expect(page.getByText("hammer / $10-$50", { exact: true })).toBeVisible(
    {
      timeout: 10_000,
    },
  )
  expect(searches).toContainEqual({
    query: "hammer",
    offset: 0,
    price: [10, 50],
    rating: null,
  })
  await expect(page.getByText("(clear)")).toBeVisible()

  await page.getByPlaceholder("Search for products...").fill("drill")
  await expect(
    page.getByText("drill / all prices", { exact: true }),
  ).toBeVisible({
    timeout: 10_000,
  })
  expect(searches).toContainEqual({
    query: "drill",
    offset: 0,
    price: null,
    rating: null,
  })
  expect(
    searches
      .filter((s) => s.query === "drill")
      .every((s) => s.price === null && s.rating === null),
  ).toBe(true)
  await expect(page.getByText("(clear)")).toBeHidden()
  await expect(page.getByPlaceholder("$0")).toHaveValue("")
  await expect(page.getByPlaceholder("$500")).toHaveValue("")

  // Observe beyond the 150ms search debounce to catch repeated invalidation.
  await page.waitForTimeout(1500)
  expect(searches.length).toBeLessThanOrEqual(6)
})
