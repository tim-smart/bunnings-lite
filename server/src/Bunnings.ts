import * as Arr from "effect/Array"
import * as Effect from "effect/Effect"
import * as Option from "effect/Option"
import * as Stream from "effect/Stream"
import {
  CurrentSession,
  FulfillmentResponse,
  ItemLocationResponse,
  PriceResponse,
  ProductPriceInfo,
  ProductResponse,
  SearchResponse,
  Session,
  SessionToken,
  SessionUnsetLocation,
  sites,
  StoresNotFound,
  StoresResponse,
  type Site,
} from "./domain/Bunnings.ts"
import {
  Cookies,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http"
import * as Context from "effect/Context"
import * as Data from "effect/Data"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import { NodeHttpClient } from "@effect/platform-node"
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { randomBytes, randomUUID } from "node:crypto"

interface Coordinates {
  readonly latitude: number
  readonly longitude: number
}

export class GuestTokenError extends Data.TaggedError("GuestTokenError") {}

export class Bunnings extends Context.Service<Bunnings>()("api/Bunnings", {
  make: Effect.gen(function* () {
    const defaultClient = yield* HttpClient.HttpClient

    // Replays the site's hidden iframe OAuth implicit flow. The redirect chain
    // sets cookies on each hop, and the token arrives in the fragment of the
    // final redirect back to bunnings.co.nz.
    const makeSession = Effect.fn("Bunnings.makeSession")(function* (
      id: string,
    ) {
      let cookies = Cookies.empty
      let request = HttpClientRequest.get(
        "https://authorisation.api.bunnings.co.nz/connect/authorize",
        {
          urlParams: {
            response_type: "token",
            scope: "chk:exec cm:access ecom:access chk:pub vch:public bsk:pub",
            client_id: "budp_guest_user_nz",
            redirect_uri: "https://www.bunnings.co.nz/static/guest.html",
            nonce: randomBytes(9).toString("hex"),
            acr_values: `adtid:${randomUUID()}`,
          },
        },
      )
      for (let redirects = 0; redirects < 10; redirects++) {
        const response = yield* defaultClient.execute(
          HttpClientRequest.setHeader(
            request,
            "cookie",
            Cookies.toCookieHeader(cookies),
          ),
        )
        const location = response.headers.location
        if (!location) break
        const url = new URL(location, response.request.url)
        if (url.origin === "https://www.bunnings.co.nz") {
          const token = yield* SessionToken.fromFragment(url.hash.slice(1))
          return new Session({
            id,
            token,
            location: SessionUnsetLocation.default,
          })
        }
        cookies = Cookies.merge(cookies, response.cookies)
        request = HttpClientRequest.get(url)
      }
      return yield* new GuestTokenError()
    })

    const apiClient = Effect.fnUntraced(function* (
      version = "v1",
      locationHeaders?: Record<string, string>,
    ) {
      const session = yield* CurrentSession
      return defaultClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl(
            `https://api.prod.bunnings.com.au/${version}`,
          ),
        ),
        HttpClient.mapRequest(
          HttpClientRequest.bearerToken(session.token.token),
        ),
        HttpClient.mapRequest(
          HttpClientRequest.setHeaders({
            accept: "application/json, text/plain, */*",
            "accept-language":
              "en-AU,en-NZ;q=0.9,en-GB;q=0.8,en-US;q=0.7,en;q=0.6,de;q=0.5",
            clientid: "mHPVWnzuBkrW7rmt56XGwKkb5Gp9BJMk",
            ...(locationHeaders ?? session.location.httpHeaders),
            stream: "RETAIL",
            userid: "anonymous",
          }),
        ),
      )
    })

    const search = Effect.fnUntraced(
      function* (options: {
        readonly query: string
        readonly offset: number
        readonly priceRange: Option.Option<readonly [number, number]>
        readonly ratingRange: Option.Option<readonly [number, number]>
      }) {
        const client = yield* apiClient()
        const session = yield* CurrentSession
        const res = yield* client.post("/coveo/search", {
          body: HttpBody.jsonUnsafe(searchPayload(session, options)),
        })
        const results =
          yield* HttpClientResponse.schemaBodyJson(SearchResponse)(res)
        return results.data
      },
      (effect, options) =>
        Effect.withSpan(effect, "Bunnings.search", {
          attributes: { ...options },
        }),
    )

    const productInfo = Effect.fn("Bunnings.productInfo")(function* (
      id: string,
    ) {
      const client = yield* apiClient()
      const res = yield* client.get(`/products/${id}`)
      const result =
        yield* HttpClientResponse.schemaBodyJson(ProductResponse)(res)
      return result.data
    })

    const priceInfo = Effect.fn("Bunnings.priceInfo")(function* (id: string) {
      const client = yield* apiClient("v2")
      const res = yield* client.get(`/products/${id}/priceInfo`)
      const result =
        yield* HttpClientResponse.schemaBodyJson(PriceResponse)(res)
      return result.data
    })

    const productInfoWithPrice = Effect.fn("Bunnings.productInfoWithPrice")(
      function* (id: string) {
        const session = yield* CurrentSession
        const [info, price] = yield* Effect.all(
          [productInfo(id), priceInfo(id)],
          { concurrency: 2 },
        )
        return new ProductPriceInfo({
          info,
          price,
          website: session.location.website,
        })
      },
    )

    const fulfillment = Effect.fn("Bunnings.fulfillment")(function* (
      id: string,
    ) {
      const session = yield* CurrentSession
      if (session.location._tag === "Unset") {
        return Option.none()
      }
      const client = yield* apiClient("v2")
      return yield* client
        .post(`/products/${id}/fulfillment`, {
          body: HttpBody.jsonUnsafe({
            includeVariantStock: true,
            isToggled: true,
            locationCode: session.location.code,
            storeRadius: "200000",
          }),
        })
        .pipe(
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(FulfillmentResponse),
          ),
          Effect.map((_) => Option.some(_.data)),
          Effect.catchTag("SchemaError", () => Effect.succeedNone),
        )
    })

    const storesPage = Effect.fn("Bunnings.stores")(function* (options: {
      readonly site: Site
      readonly near?: Coordinates
      readonly page: number
    }) {
      const client = yield* apiClient("v1", {
        country: options.site.website,
        currency: options.site.currency,
        locale: options.site.locale,
      })
      return yield* client
        .get("/stores", {
          // Without coordinates the endpoint lists every store in the country.
          urlParams: options.near
            ? {
                fields: "FULL",
                latitude: options.near.latitude,
                longitude: options.near.longitude,
                pageSize: 7,
                radius: 100000,
                currentPage: options.page,
              }
            : { fields: "FULL", pageSize: 500, currentPage: options.page },
        })
        .pipe(
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(
              Schema.Union([StoresResponse, StoresNotFound]),
            ),
          ),
          Effect.map((result) =>
            "data" in result
              ? result.data
              : { stores: [], pagination: { totalPages: 0 } },
          ),
        )
    })

    const productLocation = Effect.fn("Bunnings.productLocation")(function* (
      id: string,
    ) {
      const session = yield* CurrentSession
      if (session.location._tag === "Unset") {
        return Option.none()
      }
      const client = yield* apiClient("v1")
      return yield* client
        .get(`/item-api/locations`, {
          urlParams: {
            locationCode: session.location.code,
            productCode: id,
          },
        })
        .pipe(
          Effect.flatMap(
            HttpClientResponse.schemaBodyJson(ItemLocationResponse),
          ),
          Effect.map((_) =>
            Option.some(_.data.flatMap((_) => _.inStoreLocations)).pipe(
              Option.filter(Arr.isArrayNonEmpty),
            ),
          ),
          Effect.catchTag("SchemaError", () => Effect.succeedNone),
        )
    })

    const storesForSite = (options: {
      readonly site: Site
      readonly near?: Coordinates
    }) =>
      Stream.paginate(
        0,
        Effect.fnUntraced(function* (page) {
          const result = yield* storesPage({
            ...options,
            page,
          })
          return [
            result.stores,
            Option.some(page + 1).pipe(
              Option.filter((page) => page < result.pagination.totalPages),
            ),
          ] as const
        }),
      )

    // Each request only returns stores from one country, so try each site in
    // turn. The search radius is far smaller than the distance between them.
    const stores = (near: Coordinates) =>
      Stream.fromIterable(sites).pipe(
        Stream.flatMap((site) => storesForSite({ site, near })),
        Stream.withSpan("Bunnings.stores"),
      )

    // For picking a store by hand when the browser can't provide a location.
    const allStores = Stream.fromIterable(sites).pipe(
      Stream.flatMap((site) => storesForSite({ site })),
      Stream.withSpan("Bunnings.allStores"),
    )

    return {
      makeSession,
      search,
      productInfo,
      priceInfo,
      productInfoWithPrice,
      stores,
      allStores,
      fulfillment,
      productLocation,
    } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(NodeHttpClient.layerUndici),
  )
}

const searchPayload = (
  session: Session,
  {
    query,
    offset,
    priceRange,
    ratingRange,
  }: {
    readonly query: string
    readonly offset: number
    readonly priceRange: Option.Option<readonly [number, number]>
    readonly ratingRange: Option.Option<readonly [number, number]>
  },
) => {
  const location = session.location
  return {
    debug: false,
    enableDidYouMean: false,
    enableDuplicateFiltering: false,
    enableQuerySyntax: false,
    facetOptions: { freezeFacetOrder: true },
    filterField: "@baseid",
    filterFieldRange: 10,
    lowerCaseOperators: true,
    partialMatch: true,
    partialMatchKeywords: 2,
    partialMatchThreshold: "30%",
    questionMark: true,
    enableWordCompletion: true,
    firstResult: offset,
    isGuestUser: true,
    numberOfResults: "36",
    sortCriteria: "relevancy",
    analytics: { trackingId: location.website },
    aq: `@availableinregions==(${location.lowerRegion}) AND @price_${location.code} > 0 AND @isactive==true AND @batchcountry==(${location.website})`,
    context: session.location.searchContext,
    searchHub: "PRODUCT_SEARCH",
    cq: `@source==(PRODUCT_STREAM_${location.website})`,
    facets: [
      {
        facetId: `@price_${location.code}`,
        field: `price_${location.code}`,
        type: "numericalRange",
        injectionDepth: 1000,
        filterFacetCount: true,
        preventAutoSelect: false,
        currentValues: Option.match(priceRange, {
          onNone: () => [],
          onSome: ([start, end]) => [
            {
              preventAutoSelect: false,
              state: "selected",
              end,
              start,
            },
          ],
        }),
        numberOfValues: 1,
        freezeCurrentValues: false,
        generateAutomaticRanges: true,
        rangeAlgorithm: "even",
      },
      {
        facetId: "@rating",
        field: "rating",
        type: "numericalRange",
        injectionDepth: 1000,
        filterFacetCount: true,
        preventAutoSelect: false,
        currentValues: Option.match(ratingRange, {
          onNone: () => [],
          onSome: ([start, end]) => [
            {
              preventAutoSelect: false,
              endInclusive: true,
              state: "selected",
              end,
              start,
            },
          ],
        }),
        numberOfValues: 1,
        freezeCurrentValues: false,
      },
    ],
    groupBy: [
      {
        constantQueryOverride: `@source==(PRODUCT_STREAM_${location.website})`,
        field: `@price_${location.code}`,
        generateAutomaticRanges: true,
        maximumNumberOfValues: 1,
        advancedQueryOverride: "@uri",
        queryOverride: query,
      },
    ],
    fieldsToInclude: [
      "source",
      "thumbnailimageurl",
      "supercategoriescode",
      "validityscore",
      "supercategoriesurl",
      "supercategories",
      "ratingcount",
      "brandiconurl",
      "transactionid",
      "title",
      "date",
      "objecttype",
      "productdimensiondepth",
      "fsc",
      "currency",
      "moreoptions",
      "colorcount",
      "trustedseller",
      "colornames",
      `price_${location.code}`,
      "rowid",
      "rating",
      "size",
      "stockstatus",
      "forhire",
      "orderingid",
      "baseproduct",
      "bestseller",
      "productroutingurl",
      "brandcode",
      "categories",
      "productdimensionwidth",
      "productdimensionheight",
      "colorhexcodes",
      "brandname",
      "name",
      "itemnumber",
      "url",
      "baseid",
      "newarrival",
      "imageurl",
      "categoryiconurls",
      "uri",
      "availability",
      "code",
      "basicbundle",
      "price",
      `productRanges_${location.code}`,
      "selectedcolorhexcode",
      "description",
      "keysellingpoints",
      "brandurl",
      "sizecount",
      "timecount",
      "weightcount",
      "variantcount",
      "volumncount",
      `productRanges_${location.lowerRegion}`,
      "stockindicator",
      "productcount",
      "familycolourname",
      "unitofprice",
      `storeattributes_${location.code}`,
      "bundleproductreferences",
      "isactive",
      "sellericonurl",
      "agerestricted",
      "bundleaction",
      "sellername",
      "tintscount",
      "tints",
      "basecolor",
      "volume",
      `cprice_${location.code}`,
      "comparisonunit",
      "comparisonunitofmeasure",
      "comparisonunitofmeasurecode",
      "promotionalcampaign",
      "promotionalcampaignstart",
      "promotionalcampaignend",
      "defaultofferid",
      "isdeliveryincluded",
    ],
    context_platform: "Web",
    context_role: "retail",
    context_website: location.website,
    cu: location.httpHeaders.currency,
    de: "UTF-8",
    context_region: location.state,
    context_state: location.state,
    context_store: location.code,
    pipeline: "Variant_Product",
    q: query,
  }
}
