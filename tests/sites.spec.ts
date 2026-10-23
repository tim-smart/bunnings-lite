import { expect, test } from "@playwright/test"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import { HttpClient, HttpClientResponse } from "effect/http"
import { Bunnings } from "../server/src/Bunnings.ts"
import {
  CurrentSession,
  Session,
  SessionLocation,
  SessionToken,
  SessionUnsetLocation,
} from "../server/src/domain/Bunnings.ts"

const stores = {
  NZ: { name: "9518", displayName: "Grey Lynn", country: "New Zealand" },
  AU: { name: "7373", displayName: "Rozelle", country: "Australia" },
} as const

const storeJson = (website: keyof typeof stores) => ({
  address: {
    billingAddress: false,
    country: { isocode: website, name: stores[website].country },
    creationtime: "2021-06-08T16:05:04+0000",
    defaultAddress: false,
    email: "store@example.com",
    firstName: stores[website].displayName,
    formattedAddress: "1 Example Street",
    id: "1",
    isPoBoxAddress: false,
    line1: "1 Example Street",
    phone: "0000",
    postalCode: "0000",
    shippingAddress: false,
    town: stores[website].displayName,
    visibleInAddressBook: true,
  },
  displayName: stores[website].displayName,
  formattedDistance: "3.1 km",
  geoPoint: { latitude: 0, longitude: 0 },
  isActiveLocation: true,
  name: stores[website].name,
  pricingRegion: website === "AU" ? "NSWMetro" : "NI_Zone_1",
  storeRegion: website === "AU" ? "NSW" : "NI",
  storeZone: `${website} RZ 1`,
  timeZone: "Pacific/Auckland",
  type: "SF",
  url: "/store",
  urlRegion: "region",
})

// Mimics the Bunnings API: the stores endpoint only searches the country in
// the `country` header, and search prices are keyed by the store code.
const fakeApi = (requests: Array<Record<string, string>>) =>
  HttpClient.make((request, url) => {
    requests.push({ path: url.pathname, ...request.headers })
    let body: unknown
    if (url.pathname === "/v1/stores") {
      const website = request.headers.country as keyof typeof stores
      // Without coordinates, every store in the country is listed.
      const nearby = !url.searchParams.has("longitude")
        ? website
        : Number(url.searchParams.get("longitude")) > 160
          ? "NZ"
          : "AU"
      body =
        website === nearby
          ? {
              data: {
                boundEastLongitude: 0,
                boundNorthLatitude: 0,
                boundSouthLatitude: 0,
                boundWestLongitude: 0,
                pagination: {
                  currentPage: 0,
                  pageSize: 7,
                  totalPages: 1,
                  totalResults: 1,
                },
                sourceLatitude: 0,
                sourceLongitude: 0,
                stores: [storeJson(website)],
              },
            }
          : {
              statusDetails: { state: "FAILURE", errorCode: "BUS-4455" },
            }
    } else if (url.pathname === "/v1/coveo/search") {
      body = {
        data: {
          totalCount: 1,
          facets: [],
          results: [
            {
              raw: {
                isactive: "true",
                permanentid: "0492161",
                title: "Claw Hammer",
                productroutingurl: "/claw-hammer_p0492161",
                size: 1,
                name: "Claw Hammer",
                uri: "uri",
                [`price_${request.headers.locationcode}`]: 9.98,
              },
            },
          ],
        },
      }
    }
    return Effect.succeed(
      HttpClientResponse.fromWeb(request, Response.json(body)),
    )
  })

const nearbyStoreSearch = (coords: {
  readonly latitude: number
  readonly longitude: number
}) => {
  const requests: Array<Record<string, string>> = []
  return Effect.gen(function* () {
    const bunnings = yield* Bunnings
    const unset = new Session({
      id: "s1",
      token: new SessionToken({
        token: "t",
        expires: DateTime.makeUnsafe(Date.now() + 86_400_000),
      }),
      location: SessionUnsetLocation.default,
    })
    const found = yield* Stream.runCollect(bunnings.stores(coords)).pipe(
      Effect.provideService(CurrentSession, unset),
    )
    const session = unset.withLocation(SessionLocation.fromStore(found[0]))
    const results = yield* bunnings
      .search({
        query: "hammer",
        offset: 0,
        priceRange: Option.none(),
        ratingRange: Option.none(),
      })
      .pipe(Effect.provideService(CurrentSession, session))
    return {
      stores: found.map((store) => store.displayName),
      results: results.results.map(({ url, price }) => ({ url, price })),
      searchHeaders: requests.find((_) => _.path === "/v1/coveo/search"),
    }
  }).pipe(
    Effect.provide(
      Layer.effect(Bunnings, Bunnings.make).pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, fakeApi(requests))),
      ),
    ),
    Effect.runPromise,
  )
}

test("sites: New Zealand store search uses bunnings.co.nz", async () => {
  const result = await nearbyStoreSearch({
    latitude: -36.85,
    longitude: 174.76,
  })
  expect(result.stores).toEqual(["Grey Lynn"])
  expect(result.results).toEqual([
    { url: "https://www.bunnings.co.nz/claw-hammer_p0492161", price: 9.98 },
  ])
  expect(result.searchHeaders).toMatchObject({
    country: "NZ",
    currency: "NZD",
    locale: "en_NZ",
    locationcode: "9518",
  })
})

test("sites: Australian store search uses bunnings.com.au", async () => {
  const result = await nearbyStoreSearch({
    latitude: -33.87,
    longitude: 151.21,
  })
  expect(result.stores).toEqual(["Rozelle"])
  expect(result.results).toEqual([
    { url: "https://www.bunnings.com.au/claw-hammer_p0492161", price: 9.98 },
  ])
  expect(result.searchHeaders).toMatchObject({
    country: "AU",
    currency: "AUD",
    locale: "en_AU",
    locationcode: "7373",
  })
})

test("sites: all stores lists both countries without a location", async () => {
  const requests: Array<Record<string, string>> = []
  const found = await Effect.gen(function* () {
    const bunnings = yield* Bunnings
    return yield* Stream.runCollect(bunnings.allStores)
  }).pipe(
    Effect.provideService(
      CurrentSession,
      new Session({
        id: "s1",
        token: new SessionToken({
          token: "t",
          expires: DateTime.makeUnsafe(Date.now() + 86_400_000),
        }),
        location: SessionUnsetLocation.default,
      }),
    ),
    Effect.provide(
      Layer.effect(Bunnings, Bunnings.make).pipe(
        Layer.provide(Layer.succeed(HttpClient.HttpClient, fakeApi(requests))),
      ),
    ),
    Effect.runPromise,
  )
  expect(found.map((store) => store.displayName)).toEqual([
    "Grey Lynn",
    "Rozelle",
  ])
  expect(requests.map((_) => _.country)).toEqual(["NZ", "AU"])
})
