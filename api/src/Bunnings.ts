import { Array as Arr, Chunk, Effect, Ref, Option, Stream } from "effect"
import {
  CurrentSession,
  FulfillmentResponse,
  ItemLocationResponse,
  PriceResponse,
  ProductPriceInfo,
  ProductResponse,
  SearchResponseRemapped,
  Session,
  SessionToken,
  SessionUnsetLocation,
  StoresResponse,
} from "./domain/Bunnings"
import {
  Cookies,
  HttpBody,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform"
import { NodeHttpClient } from "@effect/platform-node"

export class Bunnings extends Effect.Service<Bunnings>()("api/Bunnings", {
  dependencies: [NodeHttpClient.layerUndici],
  effect: Effect.gen(function* () {
    const defaultClient = yield* HttpClient.HttpClient

    const makeSession = Effect.fn("Bunnings.makeSession")(function* (
      id: string,
    ) {
      const cookies = yield* Ref.make(Cookies.empty)
      const client = HttpClient.withCookiesRef(defaultClient, cookies)
      yield* client.get("https://www.bunnings.co.nz/")
      const tokenString = Cookies.getValue(
        yield* Ref.get(cookies),
        "guest-token-storage",
      ).pipe(Option.getOrElse(() => ""))
      const token = yield* SessionToken.fromJson(tokenString)
      return new Session({
        id,
        token,
        location: SessionUnsetLocation.default,
      })
    })

    const apiClient = Effect.fnUntraced(function* (version = "v1") {
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
            ...session.location.httpHeaders,
            stream: "RETAIL",
            userid: "anonymous",
          }),
        ),
      )
    })

    const search = Effect.fnUntraced(
      function* (query: string) {
        const client = yield* apiClient()
        const session = yield* CurrentSession
        const getOffset = Effect.fn("Bunnings.search.getOffset")(function* (
          offset: number,
        ) {
          const res = yield* client.post("/coveo/search", {
            body: HttpBody.unsafeJson(searchPayload(session, query, offset)),
          })
          const results = yield* HttpClientResponse.schemaBodyJson(
            SearchResponseRemapped,
          )(res)
          return [
            results.data.results.map((_) => _.raw),
            results.data.totalCount,
          ] as const
        })

        return Stream.paginateChunkEffect(0, (offset) =>
          Effect.map(getOffset(offset), ([results, totalCount]) => {
            const currentTotal = offset + results.length
            return [
              Chunk.unsafeFromArray(results.map((_) => _.asBaseInfo)),
              currentTotal < totalCount
                ? Option.some(currentTotal)
                : Option.none<number>(),
            ] as const
          }),
        )
      },
      Stream.unwrap,
      (stream, query) =>
        Stream.withSpan(stream, "Bunnings.search", { attributes: { query } }),
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
        const [info, price] = yield* Effect.all(
          [productInfo(id), priceInfo(id)],
          { concurrency: 2 },
        )
        return new ProductPriceInfo({ info, price })
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
          body: HttpBody.unsafeJson({
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
          Effect.catchTag("ParseError", () => Effect.succeedNone),
        )
    })

    const storesPage = Effect.fn("Bunnings.stores")(function* (options: {
      readonly latitude: number
      readonly longitude: number
      readonly page: number
    }) {
      const client = yield* apiClient("v1")
      return yield* client
        .get("/stores", {
          urlParams: {
            fields: "FULL",
            latitude: options.latitude,
            longitude: options.longitude,
            pageSize: 7,
            radius: 100000,
            currentPage: options.page,
          },
        })
        .pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(StoresResponse)))
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
              Option.filter(Arr.isNonEmptyReadonlyArray),
            ),
          ),
          Effect.catchTag("ParseError", () => Option.none()),
        )
    })

    const stores = Effect.fnUntraced(
      function* (options: {
        readonly latitude: number
        readonly longitude: number
      }) {
        return Stream.paginateChunkEffect(
          0,
          Effect.fnUntraced(function* (page) {
            const result = yield* storesPage({
              ...options,
              page,
            })
            return [
              result.data.stores,
              Option.some(page + 1).pipe(
                Option.filter(
                  (page) => page < result.data.pagination.totalPages,
                ),
              ),
            ] as const
          }),
        )
      },
      Stream.unwrap,
      Stream.withSpan("Bunnings.stores"),
    )

    return {
      makeSession,
      search,
      productInfo,
      priceInfo,
      productInfoWithPrice,
      stores,
      fulfillment,
      productLocation,
    } as const
  }),
}) {}

const searchPayload = (session: Session, query: string, offset: number) => {
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
