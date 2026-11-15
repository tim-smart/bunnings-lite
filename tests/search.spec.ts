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

/**
 * `hold` can keep a search's answer back until the promise it returns
 * settles, to look at the page while that search loads.
 */
async function mockRpc(
  page: Page,
  hold: (query: string) => Promise<void> | undefined = () => undefined,
) {
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
          let held: Promise<void> | undefined
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
            held = hold(p.query)
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
          const reply = JSON.stringify({
            _tag: "Exit",
            requestId: msg.id,
            exit: { _tag: "Success", value },
          })
          if (held === undefined) ws.send(reply)
          else void held.then(() => ws.send(reply))
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

test("search: a search right after clearing to home starts with the skeleton", async ({
  page,
}) => {
  let release!: () => void
  const drillHeld = new Promise<void>((resolve) => {
    release = resolve
  })
  const searches = await mockRpc(page, (query) =>
    query === "drill" ? drillHeld : undefined,
  )
  await page.goto("/?query=hammer")

  const searchBox = page.getByPlaceholder("Search for products...")
  const loading = page.getByRole("status", { name: "Loading results" })
  const hammer = page.getByText("hammer / all prices", { exact: true })
  const hammers = page.getByText("hammers / all prices", { exact: true })
  const home = page.getByRole("heading", { name: "Your store" })
  await expect(hammer).toBeVisible({ timeout: 10_000 })

  // Back from home to a cached search, then on to another
  await searchBox.fill("")
  await expect(home).toBeVisible()
  await searchBox.fill("hammer")
  await expect(hammer).toBeVisible()
  await expect(page.getByPlaceholder("$0")).toBeVisible()
  expect(searches.filter((s) => s.query === "hammer")).toHaveLength(1)
  await searchBox.fill("hammers")
  await expect(hammers).toBeVisible({ timeout: 10_000 })

  // Home, and straight on to a search that is still loading
  await searchBox.fill("")
  await expect(home).toBeVisible()
  await searchBox.fill("drill")
  await expect(loading).toBeVisible()
  await expect(hammers).toBeHidden()
  await expect(page.getByPlaceholder("$0")).toBeHidden()

  release()
  await expect(
    page.getByText("drill / all prices", { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(loading).toBeHidden()
  await expect(page.getByPlaceholder("$0")).toBeVisible()
})

test("search: typing from home waits for the typing to stop", async ({
  page,
}) => {
  const searches = await mockRpc(page)
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Your store" })).toBeVisible()

  await page
    .getByPlaceholder("Search for products...")
    .pressSequentially("hammer", { delay: 40 })
  await expect(
    page.getByText("hammer / all prices", { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  expect(searches.map((s) => s.query)).toEqual(["hammer"])
})

test("search: clearing and searching again before a render starts over", async ({
  page,
}) => {
  let release!: () => void
  const drillHeld = new Promise<void>((resolve) => {
    release = resolve
  })
  await mockRpc(page, (query) => (query === "drill" ? drillHeld : undefined))
  await page.goto("/?query=hammer")
  const hammer = page.getByText("hammer / all prices", { exact: true })
  const loading = page.getByRole("status", { name: "Loading results" })
  await expect(hammer).toBeVisible({ timeout: 10_000 })

  // Both inputs in one task, so the cleared search is never rendered
  await page
    .getByPlaceholder("Search for products...")
    .evaluate((input: HTMLInputElement) => {
      for (const value of ["", "drill"]) {
        input.value = value
        input.dispatchEvent(new Event("input", { bubbles: true }))
      }
    })
  await expect(loading).toBeVisible()
  await expect(hammer).toBeHidden()

  release()
  await expect(
    page.getByText("drill / all prices", { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
})

test("search: only the home page puts focus in the search box", async ({
  page,
}) => {
  await mockRpc(page)
  const box = page.getByRole("searchbox", { name: "Search for products" })
  await page.goto("/")
  await expect(box).toBeFocused()

  // Anywhere else, focus there would bring a phone's keyboard up over the page
  await page.goto("/?query=hammer")
  await expect(
    page.getByText("hammer / all prices", { exact: true }),
  ).toBeVisible({ timeout: 10_000 })
  await expect(box).not.toBeFocused()
})
