import { expect, test, type Page } from "@playwright/test"

const store = (
  name: string,
  displayName: string,
  country: { isocode: string; name: string },
  postalCode: string,
) => ({
  address: {
    billingAddress: false,
    country,
    creationtime: "2021-06-08T16:05:04+0000",
    defaultAddress: false,
    email: "store@example.com",
    firstName: displayName,
    formattedAddress: `1 Example Street, ${displayName} ${postalCode}`,
    id: name,
    isPoBoxAddress: false,
    line1: "1 Example Street",
    phone: "0000",
    postalCode,
    shippingAddress: false,
    town: displayName,
    visibleInAddressBook: true,
  },
  displayName,
  formattedDistance: "0 km",
  geoPoint: { latitude: 0, longitude: 0 },
  isActiveLocation: true,
  name,
  pricingRegion: country.isocode === "AU" ? "NSWMetro" : "NI_Zone_1",
  storeRegion: country.isocode === "AU" ? "NSW" : "NI",
  storeZone: "RZ 1",
  timeZone: "Pacific/Auckland",
  type: "WA",
  url: "/store",
  urlRegion: "region",
})

const nz = { isocode: "NZ", name: "New Zealand" }
const au = { isocode: "AU", name: "Australia" }
const greyLynn = store("9518", "Grey Lynn", nz, "1021")
const rozelle = store("7373", "Rozelle", au, "2039")

type Location = { code: string; city: string; website: string }

async function mockRpc(page: Page) {
  const calls = {
    logins: [] as Array<Location | null>,
    nearby: [] as Array<{ latitude: number; longitude: number }>,
    allStores: 0,
  }
  await page.routeWebSocket(/65531/, (ws) => {
    const reply = (requestId: string, value: unknown, chunk?: unknown[]) => {
      if (chunk) {
        ws.send(JSON.stringify({ _tag: "Chunk", requestId, values: chunk }))
      }
      ws.send(
        JSON.stringify({
          _tag: "Exit",
          requestId,
          exit: { _tag: "Success", value },
        }),
      )
    }
    ws.onMessage((raw) => {
      for (const line of String(raw).split("\n").filter(Boolean)) {
        const msgs = JSON.parse(line)
        for (const msg of Array.isArray(msgs) ? msgs : [msgs]) {
          if (msg._tag === "Ping") {
            ws.send(JSON.stringify({ _tag: "Pong" }))
            continue
          }
          if (msg._tag !== "Request") continue
          if (msg.tag === "login") {
            const location = msg.payload.location
            calls.logins.push(location._tag === "Some" ? location.value : null)
            reply(msg.id, {
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
            })
          } else if (msg.tag === "stores") {
            calls.nearby.push(msg.payload)
            reply(msg.id, null, [greyLynn])
          } else if (msg.tag === "allStores") {
            calls.allStores++
            reply(msg.id, null, [greyLynn, rozelle])
          }
        }
      }
    })
  })
  return calls
}

const failures = {
  "permission is denied": () => {
    navigator.geolocation.watchPosition = (_success, error) => {
      error?.({
        code: 1,
        message: "User denied Geolocation",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      })
      return 0
    }
  },
  "geolocation is unsupported": () => {
    Object.defineProperty(Navigator.prototype, "geolocation", {
      get: () => undefined,
    })
  },
}

for (const [reason, script] of Object.entries(failures)) {
  test(`stores: search for a store by hand when ${reason}`, async ({
    page,
  }) => {
    await page.addInitScript(script)
    const calls = await mockRpc(page)
    await page.goto("/")

    await page.getByRole("combobox").click()
    await expect(page.getByText("Couldn't find stores near you.")).toBeVisible()
    await page.getByRole("option", { name: "Search all stores" }).click()

    const drawer = page.getByRole("dialog", { name: "Find your store" })
    await expect(
      drawer.getByRole("button", { name: /Grey Lynn/ }),
    ).toBeVisible()
    await drawer.getByRole("searchbox", { name: "Search stores" }).fill("2039")
    await expect(drawer.getByRole("button", { name: /Grey Lynn/ })).toBeHidden()
    await drawer.getByRole("button", { name: /Rozelle/ }).click()

    await expect(drawer).toBeHidden()
    await expect(page.getByRole("combobox")).toHaveText("Rozelle")
    await expect
      .poll(() => calls.logins.at(-1))
      .toMatchObject({ code: "7373", city: "Rozelle", website: "AU" })
    expect(calls.nearby).toEqual([])
    expect(calls.allStores).toBe(1)
  })
}

test("stores: nearby stores come from the browser location", async ({
  page,
}) => {
  await page.context().grantPermissions(["geolocation"])
  await page.context().setGeolocation({ latitude: -36.85, longitude: 174.76 })
  const calls = await mockRpc(page)
  await page.goto("/")

  await page.getByRole("combobox").click()
  await page.getByRole("option", { name: "Grey Lynn" }).click()

  await expect(page.getByRole("combobox")).toHaveText("Grey Lynn")
  expect(calls.nearby).toEqual([{ latitude: -36.85, longitude: 174.76 }])
  await expect
    .poll(() => calls.logins.at(-1))
    .toMatchObject({ code: "9518", city: "Grey Lynn", website: "NZ" })
  expect(calls.allStores).toBe(0)
})
