import { Chunk, Effect, Ref, Option, Stream } from "effect"
import {
  CurrentSession,
  PriceResponse,
  ProductPriceInfo,
  ProductResponse,
  SearchResponse,
  Session,
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

    const makeSession = Effect.gen(function* () {
      const cookies = yield* Ref.make(Cookies.empty)
      const client = HttpClient.withCookiesRef(defaultClient, cookies)
      yield* client.get("https://www.bunnings.co.nz/")
      const token = Cookies.getValue(
        yield* Ref.get(cookies),
        "guest-token-storage",
      ).pipe(Option.getOrElse(() => ""))
      return yield* Session.fromJson(token)
    })

    const apiClient = Effect.fnUntraced(function* (version = "v1") {
      const session = yield* CurrentSession
      return defaultClient.pipe(
        HttpClient.mapRequest(
          HttpClientRequest.prependUrl(
            `https://api.prod.bunnings.com.au/${version}`,
          ),
        ),
        HttpClient.mapRequest(HttpClientRequest.bearerToken(session.token)),
        HttpClient.mapRequest(
          HttpClientRequest.setHeaders({
            accept: "application/json, text/plain, */*",
            "accept-language":
              "en-AU,en-NZ;q=0.9,en-GB;q=0.8,en-US;q=0.7,en;q=0.6,de;q=0.5",
            clientid: "mHPVWnzuBkrW7rmt56XGwKkb5Gp9BJMk",
            correlationid: "0ef90920-1d01-11f0-bd2b-7d53aacc737a",
            country: "NZ",
            currency: "NZD",
            locale: "en_NZ",
            locationcode: "9454",
            "sec-ch-ua":
              '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": '"macOS"',
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "cross-site",
            sessionid: "76294190-1cbc-11f0-bd99-77ece6e507f6",
            stream: "RETAIL",
            userid: "anonymous",
            "x-region": "NI_Zone_3",
          }),
        ),
      )
    })

    const search = Effect.fnUntraced(
      function* (query: string) {
        const client = yield* apiClient()
        const getOffset = Effect.fn("Bunnings.search.getOffset")(function* (
          offset: number,
        ) {
          const res = yield* client.post("/coveo/search", {
            body: HttpBody.unsafeJson(searchPayload(query, offset)),
          })
          const results =
            yield* HttpClientResponse.schemaBodyJson(SearchResponse)(res)
          return [
            results.data.results.map((_) => _.raw),
            results.data.totalCount,
          ] as const
        })

        return Stream.paginateChunkEffect(0, (offset) =>
          Effect.map(getOffset(offset), ([results, totalCount]) => {
            const currentTotal = offset + results.length
            return [
              Chunk.unsafeFromArray(results),
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

    return {
      makeSession,
      search,
      productInfo,
      priceInfo,
      productInfoWithPrice,
    } as const
  }),
}) {}

const searchPayload = (query: string, offset: number) => ({
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
  analytics: { trackingId: "NZ" },
  aq: "@availableinregions==(ni_zone_3) AND @price_9454 > 0 AND @isactive==true AND @batchcountry==(NZ)",
  context: {
    city: "Mt Maunganui",
    country: "New Zealand",
    region: "NI_Zone_3",
    state: "NI",
    website: "NZ",
  },
  facets: [
    {
      facetId: "@productranges_ni_zone_3",
      field: "productranges_ni_zone_3",
      type: "specific",
      injectionDepth: 1000,
      filterFacetCount: true,
      currentValues: [],
      numberOfValues: 8,
      freezeCurrentValues: false,
      preventAutoSelect: false,
      isFieldExpanded: false,
    },
    {
      facetId: "supercategories",
      field: "supercategories",
      type: "specific",
      injectionDepth: 1000,
      delimitingCharacter: "|",
      filterFacetCount: true,
      basePath: [],
      filterByBasePath: false,
      currentValues: [],
      preventAutoSelect: false,
      numberOfValues: 200,
      isFieldExpanded: false,
    },
    {
      facetId: "@price_9454",
      field: "price_9454",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [],
      numberOfValues: 4,
      freezeCurrentValues: false,
      generateAutomaticRanges: true,
      rangeAlgorithm: "even",
    },
    {
      facetId: "@brandname",
      field: "brandname",
      type: "specific",
      injectionDepth: 4000,
      filterFacetCount: true,
      currentValues: [],
      numberOfValues: 50,
      freezeCurrentValues: false,
      preventAutoSelect: false,
      isFieldExpanded: false,
    },
    {
      facetId: "@productoffers",
      field: "productoffers",
      type: "specific",
      injectionDepth: 1000,
      filterFacetCount: true,
      currentValues: [],
      numberOfValues: 5,
      freezeCurrentValues: false,
      preventAutoSelect: false,
      isFieldExpanded: false,
    },
    {
      facetId: "@rating",
      field: "rating",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [
        {
          start: 1,
          end: 1.99,
          endInclusive: true,
          state: "idle",
          preventAutoSelect: false,
        },
        {
          start: 2,
          end: 2.99,
          endInclusive: true,
          state: "idle",
          preventAutoSelect: false,
        },
        {
          start: 3,
          end: 3.99,
          endInclusive: true,
          state: "idle",
          preventAutoSelect: false,
        },
        {
          start: 4,
          end: 4.99,
          endInclusive: true,
          state: "idle",
          preventAutoSelect: false,
        },
        {
          start: 5,
          end: 5.99,
          endInclusive: true,
          state: "idle",
          preventAutoSelect: false,
        },
      ],
      numberOfValues: 5,
      freezeCurrentValues: false,
    },
    {
      facetId: "familycolourname",
      field: "familycolourname",
      type: "specific",
      injectionDepth: 1000,
      delimitingCharacter: "|",
      filterFacetCount: true,
      basePath: [],
      filterByBasePath: false,
      currentValues: [],
      numberOfValues: 200,
      preventAutoSelect: false,
      isFieldExpanded: false,
    },
    {
      facetId: "@height",
      field: "height",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [],
      numberOfValues: 8,
      freezeCurrentValues: false,
      generateAutomaticRanges: true,
      rangeAlgorithm: "even",
    },
    {
      facetId: "@width",
      field: "width",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [],
      numberOfValues: 8,
      freezeCurrentValues: false,
      generateAutomaticRanges: true,
      rangeAlgorithm: "even",
    },
    {
      facetId: "@depth",
      field: "depth",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [],
      numberOfValues: 8,
      freezeCurrentValues: false,
      generateAutomaticRanges: true,
      rangeAlgorithm: "even",
    },
    {
      facetId: "@volume",
      field: "volume",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [],
      numberOfValues: 8,
      freezeCurrentValues: false,
      generateAutomaticRanges: true,
      rangeAlgorithm: "even",
    },
    {
      facetId: "@weight",
      field: "weight",
      type: "numericalRange",
      injectionDepth: 1000,
      filterFacetCount: true,
      preventAutoSelect: false,
      currentValues: [],
      numberOfValues: 8,
      freezeCurrentValues: false,
      generateAutomaticRanges: true,
      rangeAlgorithm: "even",
    },
  ],
  groupBy: [
    {
      constantQueryOverride: "@source==(PRODUCT_STREAM_NZ)",
      field: "@price_9454",
      generateAutomaticRanges: true,
      maximumNumberOfValues: 1,
      advancedQueryOverride: "@uri",
      queryOverride: "nail",
    },
    { advancedQueryOverride: "@uri", field: "@supercategoriesurl" },
    {
      advancedQueryOverride: "",
      constantQueryOverride:
        "@availableinregions==(ni_zone_3) AND @price_9454 > 0 AND @isactive==true AND @batchcountry==(NZ) AND @source==(PRODUCT_STREAM_NZ) OR @z95xtemplate==(d16262d2fbdc4dbfbb6443c5c4ebc3db) AND @showInSearch=1 AND @isServiceStatusActive=1 AND @source==BUDP_NZ_web_index-ProdEnv_BunningsSC OR @z95xtemplate==(4cb3a49604b24ef1b674576fd8f4650b,cf6199d71fa0444eaa247f722d26549e,8b6affd59ae942239d81d0850d888b6e,5a2d6c7ccfe54199976037394fdf1951,36815b6e0e7447fbbb5e968469c5c722,faeb71ebfdff45e49fde2659dd1bfa0f,45fc1c8036984dd6bcd583d87478a544) AND @showInSearch=1 AND @source==BUDP_NZ_web_index-ProdEnv_BunningsSC OR @source==(DOCUMENTS_NZ) OR @source==(BUDP_NZ_web_index-ProdEnv_BunningsSC) AND @z95xtemplate==(77a66eda8b7f473aa926d50a8f275878,90e723f5117a4b5389e7f3d953107314,a15f4d221ffd48689a230c56a8af469f,d4c502cf433a48a19d2dc948e122a18e,ca541b39ae8944319af40212f45258ca,8b6affd59ae942239d81d0850d888b6e,fbb9f0d878284d1cb178655782f72107,426714719f734a9983f1b7a8703c98e8,4208175b8c98404c924bd2c8558ca279) AND @showInSearch=1 OR @source==(Brands_web_index-ProdEnv_BunningsSC) AND @z95xtemplate==(d3221b08e0a64d4aa8ac7e5a7d0ddba7) AND @language==en-NZ AND @brandActiveInCurrentLanguage=1 AND @showInSearch=1",
      field: "@searchtab",
      filterFacetCount: true,
      queryOverride: "nail",
    },
  ],
  searchHub: "PRODUCT_SEARCH",
  cq: "@source==(PRODUCT_STREAM_NZ)",
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
    "price_9454",
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
    "productRanges_9454",
    "selectedcolorhexcode",
    "description",
    "keysellingpoints",
    "brandurl",
    "sizecount",
    "timecount",
    "weightcount",
    "variantcount",
    "volumncount",
    "productRanges_ni_zone_3",
    "stockindicator",
    "productcount",
    "familycolourname",
    "unitofprice",
    "storeattributes_9454",
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
    "cprice_9454",
    "comparisonunit",
    "comparisonunitofmeasure",
    "comparisonunitofmeasurecode",
    "promotionalcampaign",
    "promotionalcampaignstart",
    "promotionalcampaignend",
    "defaultofferid",
    "isdeliveryincluded",
  ],
  generateAutomaticFacets: { desiredCount: 10, fields: {}, numberOfValues: 10 },
  context_platform: "Web",
  context_role: "retail",
  context_website: "NZ",
  cu: "NZD",
  de: "UTF-8",
  context_region: "NI",
  context_state: "NI",
  context_store: "9454",
  pipeline: "Variant_Product",
  q: query,
})
