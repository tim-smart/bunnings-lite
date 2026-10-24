import { expect, test, type Page } from "@playwright/test"

const image = {
  mime: "image/jpeg",
  sequence: "0",
  thumbnailUrl: "https://example.com/t.jpg",
  url: "https://example.com/i.jpg",
}

const feature = (name: string, ...values: Array<string>) => ({
  code: name.toLowerCase().replace(/\W+/g, "_"),
  comparable: true,
  featureValues: values.map((value) => ({ value })),
  name,
  range: false,
})

const productInfo = {
  info: {
    allCategories: [],
    availableForDelivery: true,
    averageRating: 4,
    baseOptions: [
      {
        selected: {
          code: "0715241",
          itemNumber: "0715241",
          productValues: [],
          routingUrl: "/ryobi-drill_p0715241",
        },
        variantType: "BaseVariant",
      },
    ],
    bestSeller: false,
    brand: {
      brandUrl: "/brands/ryobi",
      code: "ryobi",
      isLeadingBrand: true,
      isMarketPlaceBrand: false,
      isTradeBrand: false,
      name: "Ryobi",
    },
    defaultVariant: true,
    dimension: {
      dimensionTerm: "L",
      packages: [{ height: "228 mm", length: "200 mm", width: "179 mm" }],
      product: [{ depth: "225", height: "203", width: "173" }],
    },
    feature: { description: "A drill." },
    images: [image],
    instorePickup: true,
    isAREnabled: false,
    isActive: true,
    isAgeRestricted: false,
    isDangerousGood: false,
    isPOAProduct: false,
    isSpecialProduct: false,
    isTradeOnly: false,
    isWorkflowRequired: false,
    itemNumber: "0715241",
    name: "Ryobi 18V ONE+ Drill Driver Starter Kit",
    newArrival: false,
    numberOfReviews: 1,
    productLinks: [],
    purchasable: true,
    summary: "",
    sustainabilityInformation: "",
    transactable: true,
    unitofprice: "EA",
    url: "/ryobi-drill_p0715241",
    visible: true,
    warrantyReturns: "",
    weight: "2.4",
    classifications: [
      {
        code: "corded-drill-driver",
        name: "CORDED DRILL DRIVER",
        features: [
          feature("Model Number", "R18DD22"),
          feature("Chuck Size", "2-13"),
          feature("Chuck Type", "13mm keyless"),
          feature("Application Method", "Brush", "Roller"),
          feature("Maximum Speed (rpm)", "1750"),
          feature("Indoor Use (Yes/No)", "Yes"),
          feature("Empty", ""),
        ],
      },
    ],
  },
  price: {
    currencyIso: "NZD",
    formattedValue: "$199.00",
    priceAvailable: true,
    priceType: "BUY",
    value: 199,
  },
  website: "NZ",
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
                _tag: "Unset",
                country: "New Zealand",
                website: "NZ",
                code: "9489",
                region: "NI_Zone_9",
                state: "NI",
              },
            }
          } else if (msg.tag === "productInfo") {
            value = productInfo
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

test.use({ viewport: { width: 320, height: 800 } })

test("product page: lists the Bunnings specifications", async ({ page }) => {
  await mockRpc(page)
  await page.goto("/product/0715241")

  const section = page.getByRole("region", { name: "Specifications" })
  await expect(section).toBeVisible({ timeout: 10_000 })

  const rows = section.locator("dl > div")
  const specs = await rows.evaluateAll((els) =>
    els.map((el) => [
      el.querySelector("dt")?.textContent,
      el.querySelector("dd")?.textContent,
    ]),
  )
  expect(specs).toEqual([
    ["Brand", "Ryobi"],
    ["Model Number", "R18DD22"],
    ["Chuck Size", "2-13"],
    ["Chuck Type", "13mm keyless"],
    ["Application Method", "Brush, Roller"],
    ["Maximum Speed", "1750 rpm"],
    ["Indoor Use", "Yes"],
    ["Height", "203 mm"],
    ["Width", "173 mm"],
    ["Depth", "225 mm"],
    ["Weight", "2.4 kg"],
  ])

  // The table fits a narrow phone without scrolling sideways
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
