import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as ParseResult from "effect/ParseResult"
import * as Schema from "effect/Schema"

export class CurrentSession extends Context.Tag(
  "domain/Bunnings/CurrentSession",
)<CurrentSession, Session>() {}

export class SessionLocation extends Schema.TaggedClass<SessionLocation>(
  "domain/Bunnings/SessionLocation",
)("Set", {
  region: Schema.String,
  code: Schema.String,
  city: Schema.String,
  country: Schema.String,
  state: Schema.String,
  website: Schema.String,
}) {
  static fromStore(store: Store) {
    return new SessionLocation({
      region: store.pricingRegion,
      code: store.name,
      city: store.displayName,
      country: store.address.country.name,
      state: store.storeRegion,
      website: store.address.country.isocode,
    })
  }

  get lowerRegion() {
    return this.region.toLowerCase()
  }

  httpHeaders = {
    locationcode: this.code,
    "x-region": this.region,
    country: this.website,
    currency: "NZD",
    locale: "en_NZ",
  }

  searchContext = {
    city: this.city,
    country: this.country,
    region: this.region,
    state: this.state,
    website: this.website,
  }
}

export class SessionUnsetLocation extends Schema.TaggedClass<SessionUnsetLocation>(
  "domain/Bunnings/SessionUnsetLocation",
)("Unset", {
  country: Schema.String,
  website: Schema.String,
  code: Schema.String,
  region: Schema.String,
  state: Schema.String,
}) {
  static default = new SessionUnsetLocation({
    country: "New Zealand",
    website: "NZ",
    code: "9489",
    region: "NI_Zone_9",
    state: "NI",
  })

  get lowerRegion() {
    return this.region.toLowerCase()
  }

  httpHeaders = {
    country: this.website,
    currency: "NZD",
    locale: "en_NZ",
  }

  searchContext = {
    country: this.country,
    website: this.website,
  }
}

export class SessionToken extends Schema.Class<SessionToken>(
  "domain/Bunnings/SessionToken",
)({
  expires: Schema.DateTimeUtcFromNumber,
  token: Schema.String,
}) {
  static fromJson = Schema.decode(Schema.parseJson(SessionToken))
}

export class Session extends Schema.Class<Session>("domain/Bunnings/Session")({
  id: Schema.String,
  token: SessionToken,
  location: Schema.Union(SessionLocation, SessionUnsetLocation),
}) {
  get expired() {
    return this.token.expires.pipe(
      DateTime.subtract({ hours: 1 }),
      DateTime.unsafeIsPast,
    )
  }

  withLocation(location: SessionLocation) {
    return new Session({
      ...this,
      location,
    })
  }
}

const ImageUrl = Schema.optionalWith(Schema.String, {
  default: () => "https://www.bunnings.co.nz/static/icons/notFoundImage.svg",
})

export class SearchResult extends Schema.Class<SearchResult>("SearchResult")({
  thumbnailimageurl: ImageUrl,
  isactive: Schema.String,
  ratingcount: Schema.optionalWith(Schema.Number, {
    default: () => 0,
  }),
  permanentid: Schema.String,
  title: Schema.String,
  productroutingurl: Schema.String,
  rating: Schema.optionalWith(Schema.Number, {
    default: () => 0,
  }),
  size: Schema.Number,
  name: Schema.String,
  price: Schema.Number,
  imageurl: ImageUrl,
  uri: Schema.String,
}) {
  get asBaseInfo() {
    return new ProductBaseInfo({
      id: this.permanentid,
      url: "https://bunnings.co.nz" + this.productroutingurl,
      title: this.title,
      images: [
        new ImageElement({
          url: this.imageurl,
          thumbnailUrl: this.thumbnailimageurl,
          mime: "image/jpeg",
          sequence: "0",
        }),
      ],
      price: this.price,
      numberOfReviews: this.ratingcount,
      rating: this.rating,
    })
  }
}

export class SearchResultWrap extends Schema.Class<SearchResultWrap>(
  "SearchResultWrap",
)({
  raw: SearchResult,
}) {}

export class ImageElement extends Schema.Class<ImageElement>("ImageElement")({
  altText: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  format: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  imageType: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  mime: Schema.String,
  sequence: Schema.String,
  thumbnailUrl: ImageUrl,
  url: ImageUrl,
  videoId: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
}) {}

export class ProductBaseInfo extends Schema.Class<ProductBaseInfo>(
  "ProductBaseInfo",
)({
  id: Schema.String,
  title: Schema.String,
  url: Schema.String,
  images: Schema.NonEmptyArray(ImageElement),
  price: Schema.Number,
  numberOfReviews: Schema.Number,
  rating: Schema.Number,
}) {}

export class FacetValue extends Schema.Class<FacetValue>("FacetValue")({
  start: Schema.Number,
  end: Schema.Number,
  endInclusive: Schema.Boolean,
}) {}

export class Facet extends Schema.Class<Facet>("Facet")({
  facetId: Schema.String,
  values: Schema.Array(FacetValue),
}) {}

export class SearchResponseDataRaw extends Schema.Class<SearchResponseDataRaw>(
  "SearchResponseDataRaw",
)({
  totalCount: Schema.Number,
  facets: Schema.Array(Facet),
  results: Schema.Array(SearchResultWrap),
}) {}

export class SearchResponseData extends Schema.Class<SearchResponseData>(
  "SearchResponseData",
)({
  totalCount: Schema.Number,
  facets: Schema.Array(Facet),
  results: Schema.Array(ProductBaseInfo),
}) {}

export const SearchResponseDataRemapped = Schema.transformOrFail(
  Schema.Object,
  SearchResponseDataRaw,
  {
    decode(data: any) {
      return Effect.map(CurrentSession, (session) => ({
        totalCount: data.totalCount,
        facets: data.facets.map((facet: any) => ({
          ...facet,
          facetId: facet.facetId.replace(`_${session.location.code}`, ""),
        })),
        results: data.results.map((result: any) => ({
          raw: {
            ...result.raw,
            price: result.raw[`price_${session.location.code}`],
          },
        })),
      }))
    },
    encode(toI) {
      return ParseResult.succeed(toI)
    },
  },
).pipe(
  Schema.transform(SearchResponseData, {
    decode(fromA) {
      return new SearchResponseData({
        ...fromA,
        results: fromA.results.map((_) => _.raw.asBaseInfo),
      })
    },
    encode(_toI) {
      throw new Error("Not implemented")
    },
  }),
)

export const SearchResponse = Schema.Struct({
  data: SearchResponseDataRemapped,
})

export class GuideDocument extends Schema.Class<GuideDocument>("GuideDocument")(
  {
    altText: Schema.optionalWith(Schema.String, { nullable: true }),
    docType: Schema.String,
    mime: Schema.String,
    sequence: Schema.String,
    size: Schema.Number,
    thumbnailUrl: ImageUrl,
    url: Schema.String,
  },
) {}

export class DataFeature extends Schema.Class<DataFeature>("DataFeature")({
  description: Schema.String,
  pointers: Schema.optional(Schema.Array(Schema.String)),
}) {}

export class Product extends Schema.Class<Product>("Product")({
  depth: Schema.String,
  height: Schema.String,
  width: Schema.String,
  label: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
}) {}

export class Package extends Schema.Class<Package>("Package")({
  height: Schema.String,
  length: Schema.String,
  width: Schema.String,
}) {}

export class Dimension extends Schema.Class<Dimension>("Dimension")({
  packages: Schema.optionalWith(Schema.Array(Package), {
    default: () => [],
  }),
  product: Schema.optionalWith(Schema.Array(Product), {
    default: () => [],
  }),
  dimensionTerm: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
}) {}

export class FeatureValue extends Schema.Class<FeatureValue>("FeatureValue")({
  value: Schema.String,
}) {}

export class FeatureElement extends Schema.Class<FeatureElement>(
  "FeatureElement",
)({
  code: Schema.String,
  comparable: Schema.Boolean,
  featureValues: Schema.Array(FeatureValue),
  name: Schema.String,
  range: Schema.Boolean,
}) {}

export class Classification extends Schema.Class<Classification>(
  "Classification",
)({
  features: Schema.Array(FeatureElement),
  code: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  name: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
}) {}

export class BrandImage extends Schema.Class<BrandImage>("BrandImage")({
  mime: Schema.String,
  sequence: Schema.String,
  thumbnailUrl: ImageUrl,
  url: ImageUrl,
  disclaimer: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
}) {}

export class Brand extends Schema.Class<Brand>("Brand")({
  brandUrl: Schema.String,
  code: Schema.String,
  image: Schema.optional(BrandImage),
  isLeadingBrand: Schema.Boolean,
  isMarketPlaceBrand: Schema.Boolean,
  isTradeBrand: Schema.Boolean,
  name: Schema.String,
}) {}

export class ProductValue extends Schema.Class<ProductValue>("ProductValue")({
  displayOrder: Schema.Number,
  name: Schema.String,
  value: Schema.String,
}) {}

export class BasePaint extends Schema.Class<BasePaint>("BasePaint")({
  colorName: Schema.String,
}) {}

export class Selected extends Schema.Class<Selected>("Selected")({
  basePaint: Schema.optional(Schema.Union(BasePaint, Schema.Null)),
  code: Schema.String,
  itemNumber: Schema.String,
  productValues: Schema.Array(ProductValue),
  routingUrl: Schema.String,
}) {}

export class BaseOption extends Schema.Class<BaseOption>("BaseOption")({
  selected: Selected,
  variantType: Schema.String,
}) {}

export class AllCategory extends Schema.Class<AllCategory>("AllCategory")({
  code: Schema.String,
  displayName: Schema.String,
  internalPath: Schema.String,
  level: Schema.Number,
  workShopCategory: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
}) {}

export class ProductInfo extends Schema.Class<ProductInfo>("ProductInfo")({
  allCategories: Schema.Array(AllCategory),
  availableForDelivery: Schema.Boolean,
  averageRating: Schema.optionalWith(Schema.Number, {
    default: () => 0,
  }),
  baseOptions: Schema.Array(BaseOption),
  bestSeller: Schema.Boolean,
  brand: Brand,
  defaultVariant: Schema.Boolean,
  dimension: Dimension,
  feature: DataFeature,
  images: Schema.NonEmptyArray(ImageElement),
  instorePickup: Schema.Boolean,
  isAREnabled: Schema.Boolean,
  isActive: Schema.Boolean,
  isAgeRestricted: Schema.Boolean,
  isDangerousGood: Schema.Boolean,
  isPOAProduct: Schema.Boolean,
  isSpecialProduct: Schema.Boolean,
  isTradeOnly: Schema.Boolean,
  isWorkflowRequired: Schema.Boolean,
  itemNumber: Schema.String,
  manufacturer: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  name: Schema.String,
  newArrival: Schema.Boolean,
  numberOfReviews: Schema.Number,
  productLinks: Schema.Array(Schema.String),
  purchasable: Schema.Boolean,
  summary: Schema.String,
  sustainabilityInformation: Schema.String,
  transactable: Schema.Boolean,
  unitofprice: Schema.String,
  url: Schema.String,
  visible: Schema.Boolean,
  warrantyReturns: Schema.String,
  weight: Schema.optional(Schema.String),
  guideDocument: Schema.optional(
    Schema.Union(Schema.Array(GuideDocument), Schema.Null),
  ),
}) {}

export class ProductResponse extends Schema.Class<ProductResponse>(
  "ProductResponse",
)({
  data: ProductInfo,
}) {}

export class PriceInfo extends Schema.Class<PriceInfo>("PriceInfo")({
  currencyIso: Schema.String,
  formattedValue: Schema.String,
  priceAvailable: Schema.Boolean,
  priceType: Schema.String,
  value: Schema.Number,
}) {}

export class PriceResponse extends Schema.Class<PriceResponse>("PriceResponse")(
  {
    data: PriceInfo,
  },
) {}

export class ProductPriceInfo extends Schema.Class<ProductPriceInfo>(
  "ProductPriceInfo",
)({
  info: ProductInfo,
  price: PriceInfo,
}) {
  get asBaseInfo() {
    return new ProductBaseInfo({
      id: this.info.itemNumber,
      url:
        "https://bunnings.co.nz" + this.info.baseOptions[0].selected.routingUrl,
      title: this.info.name,
      images: this.info.images,
      price: this.price.value,
      numberOfReviews: this.info.numberOfReviews,
      rating: this.info.averageRating,
    })
  }
}

class GeoPoint extends Schema.Class<GeoPoint>("GeoPoint")({
  latitude: Schema.Number,
  longitude: Schema.Number,
}) {}

class Country extends Schema.Class<Country>("Country")({
  isocode: Schema.String,
  name: Schema.String,
}) {}

class Address extends Schema.Class<Address>("Address")({
  billingAddress: Schema.Boolean,
  country: Country,
  creationtime: Schema.String,
  defaultAddress: Schema.Boolean,
  email: Schema.String,
  fax: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  firstName: Schema.String,
  formattedAddress: Schema.String,
  id: Schema.String,
  isPoBoxAddress: Schema.Boolean,
  line1: Schema.String,
  line2: Schema.optional(Schema.Union(Schema.Null, Schema.String)),
  phone: Schema.String,
  postalCode: Schema.String,
  shippingAddress: Schema.Boolean,
  town: Schema.String,
  visibleInAddressBook: Schema.Boolean,
}) {}

export class Store extends Schema.Class<Store>("Store")({
  address: Address,
  displayName: Schema.String,
  formattedDistance: Schema.String,
  geoPoint: GeoPoint,
  isActiveLocation: Schema.Boolean,
  mapUrl: Schema.String,
  name: Schema.String,
  pricingRegion: Schema.String,
  storeRegion: Schema.String,
  storeZone: Schema.String,
  timeZone: Schema.String,
  type: Schema.String,
  url: Schema.String,
  urlRegion: Schema.String,
}) {}

class Pagination extends Schema.Class<Pagination>("Pagination")({
  currentPage: Schema.Number,
  pageSize: Schema.Number,
  totalPages: Schema.Number,
  totalResults: Schema.Number,
}) {}

export class StoresData extends Schema.Class<StoresData>("StoresData")({
  boundEastLongitude: Schema.Number,
  boundNorthLatitude: Schema.Number,
  boundSouthLatitude: Schema.Number,
  boundWestLongitude: Schema.Number,
  pagination: Pagination,
  sourceLatitude: Schema.Number,
  sourceLongitude: Schema.Number,
  stores: Schema.Chunk(Store),
}) {}

export class StoresResponse extends Schema.Class<StoresResponse>(
  "StoresResponse",
)({
  data: StoresData,
}) {}

// fullfillment

export class InStorePickUpData extends Schema.Class<InStorePickUpData>(
  "InStorePickUpData",
)({
  inStoreStockMsg: Schema.String,
  stock: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

export class FulfillmentInfo extends Schema.Class<FulfillmentInfo>(
  "FulfillmentInfo",
)({
  addToCartEnabled: Schema.Boolean,
  availableInStore: Schema.Boolean,
  disableStockVisibility: Schema.Boolean,
  driveNCollect: Schema.String,
  inStorePickUpData: InStorePickUpData,
  isActive: Schema.Boolean,
  isSpecialProduct: Schema.Boolean,
  poa: Schema.Boolean,
}) {}

export class FulfillmentResponse extends Schema.Class<FulfillmentResponse>(
  "FulfillmentResponse",
)({
  data: FulfillmentInfo,
}) {}

// item location

export class InStoreLocation extends Schema.Class<InStoreLocation>(
  "InStoreLocation",
)({
  aisle: Schema.String,
  bay: Schema.String,
  sequence: Schema.String,
}) {}

export class ItemLocations extends Schema.Class<ItemLocations>("ItemLocations")(
  {
    inStoreLocations: Schema.Array(InStoreLocation),
  },
) {}

export class ItemLocationResponse extends Schema.Class<ItemLocationResponse>(
  "ItemLocationResponse",
)({
  data: Schema.Array(ItemLocations),
}) {}

export class FulfillmentInfoWithLocation extends Schema.Class<FulfillmentInfoWithLocation>(
  "FulfillmentInfoWithLocation",
)({
  fulfillment: FulfillmentInfo,
  location: Schema.Option(InStoreLocation),
}) {
  get isAvailable() {
    return (
      this.fulfillment.inStorePickUpData.inStoreStockMsg ===
      "itemsAvailableInStock"
    )
  }
}
