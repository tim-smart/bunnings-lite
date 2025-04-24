import {
  Context,
  DateTime,
  Effect,
  Schema,
  Schema as S,
  ParseResult,
} from "effect"

export class CurrentSession extends Context.Tag(
  "domain/Bunnings/CurrentSession",
)<CurrentSession, Session>() {}

export class SessionLocation extends Schema.TaggedClass<SessionLocation>(
  "domain/Bunnings/SessionLocation",
)("Set", {
  region: S.String,
  code: S.String,
  city: S.String,
  country: S.String,
  state: S.String,
  website: S.String,
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
  country: S.String,
  website: S.String,
  code: S.String,
  region: S.String,
  state: S.String,
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
  id: S.String,
  token: SessionToken,
  location: Schema.Union(SessionLocation, SessionUnsetLocation),
}) {
  get expired() {
    return this.token.expires.pipe(
      DateTime.subtract({ hours: 1 }),
      DateTime.lessThan(DateTime.unsafeNow()),
    )
  }

  withLocation(location: SessionLocation) {
    return new Session({
      ...this,
      location,
    })
  }
}

export class SearchResult extends S.Class<SearchResult>("SearchResult")({
  thumbnailimageurl: S.String,
  isactive: S.String,
  ratingcount: S.optionalWith(S.Number, { default: () => 0 }),
  permanentid: S.String,
  title: S.String,
  productroutingurl: S.String,
  rating: S.Number,
  size: S.Number,
  name: S.String,
  price: S.Number,
  imageurl: S.String,
  uri: S.String,
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

export class SearchResultWrap extends S.Class<SearchResultWrap>(
  "SearchResultWrap",
)({
  raw: SearchResult,
}) {}

export const SearchResponse = S.Struct({
  data: S.Struct({
    totalCount: S.Number,
    results: S.Array(SearchResultWrap),
  }),
})

export const SearchResponseRemapped = S.transformOrFail(
  S.Object,
  SearchResponse,
  {
    decode(fromA: any) {
      return Effect.map(CurrentSession, (session) => ({
        data: {
          totalCount: fromA.data.totalCount,
          results: fromA.data.results.map((result: any) => ({
            raw: {
              ...result.raw,
              price: result.raw[`price_${session.location.code}`],
            },
          })),
        },
      }))
    },
    encode(toI) {
      return ParseResult.succeed(toI)
    },
  },
)

export class ImageElement extends S.Class<ImageElement>("ImageElement")({
  altText: S.optional(S.Union(S.Null, S.String)),
  format: S.optional(S.Union(S.Null, S.String)),
  imageType: S.optional(S.Union(S.Null, S.String)),
  mime: S.String,
  sequence: S.String,
  thumbnailUrl: S.String,
  url: S.String,
  videoId: S.optional(S.Union(S.Null, S.String)),
}) {}

export class GuideDocument extends S.Class<GuideDocument>("GuideDocument")({
  altText: S.optionalWith(S.String, { nullable: true }),
  docType: S.String,
  mime: S.String,
  sequence: S.String,
  size: S.Number,
  thumbnailUrl: S.String,
  url: S.String,
}) {}

export class DataFeature extends S.Class<DataFeature>("DataFeature")({
  description: S.String,
  pointers: S.Array(S.String),
}) {}

export class Product extends S.Class<Product>("Product")({
  depth: S.String,
  height: S.String,
  width: S.String,
  label: S.optional(S.Union(S.Null, S.String)),
}) {}

export class Package extends S.Class<Package>("Package")({
  height: S.String,
  length: S.String,
  width: S.String,
}) {}

export class Dimension extends S.Class<Dimension>("Dimension")({
  packages: S.Array(Package),
  product: S.Array(Product),
  dimensionTerm: S.optional(S.Union(S.Null, S.String)),
}) {}

export class FeatureValue extends S.Class<FeatureValue>("FeatureValue")({
  value: S.String,
}) {}

export class FeatureElement extends S.Class<FeatureElement>("FeatureElement")({
  code: S.String,
  comparable: S.Boolean,
  featureValues: S.Array(FeatureValue),
  name: S.String,
  range: S.Boolean,
}) {}

export class Classification extends S.Class<Classification>("Classification")({
  features: S.Array(FeatureElement),
  code: S.optional(S.Union(S.Null, S.String)),
  name: S.optional(S.Union(S.Null, S.String)),
}) {}

export class BrandImage extends S.Class<BrandImage>("BrandImage")({
  mime: S.String,
  sequence: S.String,
  thumbnailUrl: S.String,
  url: S.String,
  disclaimer: S.optional(S.Union(S.Null, S.String)),
}) {}

export class Brand extends S.Class<Brand>("Brand")({
  brandUrl: S.String,
  code: S.String,
  image: S.optional(BrandImage),
  isLeadingBrand: S.Boolean,
  isMarketPlaceBrand: S.Boolean,
  isTradeBrand: S.Boolean,
  name: S.String,
}) {}

export class ProductValue extends S.Class<ProductValue>("ProductValue")({
  displayOrder: S.Number,
  name: S.String,
  value: S.String,
}) {}

export class BasePaint extends S.Class<BasePaint>("BasePaint")({
  colorName: S.String,
}) {}

export class Selected extends S.Class<Selected>("Selected")({
  basePaint: S.optional(S.Union(BasePaint, S.Null)),
  code: S.String,
  itemNumber: S.String,
  productValues: S.Array(ProductValue),
  routingUrl: S.String,
}) {}

export class BaseOption extends S.Class<BaseOption>("BaseOption")({
  selected: Selected,
  variantType: S.String,
}) {}

export class AllCategory extends S.Class<AllCategory>("AllCategory")({
  code: S.String,
  displayName: S.String,
  internalPath: S.String,
  level: S.Number,
  workShopCategory: S.optional(S.Union(S.Null, S.String)),
}) {}

export class ProductBaseInfo extends Schema.Class<ProductBaseInfo>(
  "ProductBaseInfo",
)({
  id: S.String,
  title: S.String,
  url: S.String,
  images: S.NonEmptyArray(ImageElement),
  price: S.Number,
  numberOfReviews: S.Number,
  rating: S.Number,
}) {}

export class ProductInfo extends S.Class<ProductInfo>("ProductInfo")({
  allCategories: S.Array(AllCategory),
  availableForDelivery: S.Boolean,
  averageRating: S.optionalWith(S.Number, { default: () => 0 }),
  baseOptions: S.Array(BaseOption),
  bestSeller: S.Boolean,
  brand: Brand,
  defaultVariant: S.Boolean,
  dimension: Dimension,
  feature: DataFeature,
  images: S.NonEmptyArray(ImageElement),
  instorePickup: S.Boolean,
  isAREnabled: S.Boolean,
  isActive: S.Boolean,
  isAgeRestricted: S.Boolean,
  isDangerousGood: S.Boolean,
  isPOAProduct: S.Boolean,
  isSpecialProduct: S.Boolean,
  isTradeOnly: S.Boolean,
  isWorkflowRequired: S.Boolean,
  itemNumber: S.String,
  manufacturer: S.optional(S.Union(S.Null, S.String)),
  name: S.String,
  newArrival: S.Boolean,
  numberOfReviews: S.Number,
  productLinks: S.Array(S.String),
  purchasable: S.Boolean,
  summary: S.String,
  sustainabilityInformation: S.String,
  transactable: S.Boolean,
  unitofprice: S.String,
  url: S.String,
  visible: S.Boolean,
  warrantyReturns: S.String,
  weight: S.optional(S.String),
  guideDocument: S.optional(S.Union(S.Array(GuideDocument), S.Null)),
}) {}

export class ProductResponse extends S.Class<ProductResponse>(
  "ProductResponse",
)({
  data: ProductInfo,
}) {}

export class PriceInfo extends S.Class<PriceInfo>("PriceInfo")({
  currencyIso: S.String,
  formattedValue: S.String,
  priceAvailable: S.Boolean,
  priceType: S.String,
  value: S.Number,
}) {}

export class PriceResponse extends S.Class<PriceResponse>("PriceResponse")({
  data: PriceInfo,
}) {}

export class ProductPriceInfo extends S.Class<ProductPriceInfo>(
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

class GeoPoint extends S.Class<GeoPoint>("GeoPoint")({
  latitude: S.Number,
  longitude: S.Number,
}) {}

class Country extends S.Class<Country>("Country")({
  isocode: S.String,
  name: S.String,
}) {}

class Address extends S.Class<Address>("Address")({
  billingAddress: S.Boolean,
  country: Country,
  creationtime: S.String,
  defaultAddress: S.Boolean,
  email: S.String,
  fax: S.optional(S.Union(S.Null, S.String)),
  firstName: S.String,
  formattedAddress: S.String,
  id: S.String,
  isPoBoxAddress: S.Boolean,
  line1: S.String,
  line2: S.optional(S.Union(S.Null, S.String)),
  phone: S.String,
  postalCode: S.String,
  shippingAddress: S.Boolean,
  town: S.String,
  visibleInAddressBook: S.Boolean,
}) {}

export class Store extends S.Class<Store>("Store")({
  address: Address,
  description: S.String,
  displayName: S.String,
  driveNCollect: S.String,
  formattedDistance: S.String,
  geoPoint: GeoPoint,
  isActiveLocation: S.Boolean,
  mapUrl: S.String,
  name: S.String,
  pricingRegion: S.String,
  storeRegion: S.String,
  storeZone: S.String,
  timeZone: S.String,
  type: S.String,
  underOMSTrial: S.Boolean,
  url: S.String,
  urlRegion: S.String,
}) {}

class Pagination extends S.Class<Pagination>("Pagination")({
  currentPage: S.Number,
  pageSize: S.Number,
  totalPages: S.Number,
  totalResults: S.Number,
}) {}

export class StoresData extends S.Class<StoresData>("StoresData")({
  boundEastLongitude: S.Number,
  boundNorthLatitude: S.Number,
  boundSouthLatitude: S.Number,
  boundWestLongitude: S.Number,
  pagination: Pagination,
  sourceLatitude: S.Number,
  sourceLongitude: S.Number,
  stores: S.Chunk(Store),
}) {}

export class StoresResponse extends S.Class<StoresResponse>("StoresResponse")({
  data: StoresData,
}) {}

// fullfillment

export class InStorePickUpData extends S.Class<InStorePickUpData>(
  "InStorePickUpData",
)({
  inStoreStockMsg: S.String,
  stock: S.optionalWith(S.Number, { default: () => 0 }),
}) {}

export class FulfillmentInfo extends S.Class<FulfillmentInfo>(
  "FulfillmentInfo",
)({
  addToCartEnabled: S.Boolean,
  availableInStore: S.Boolean,
  disableStockVisibility: S.Boolean,
  driveNCollect: S.String,
  inStorePickUpData: InStorePickUpData,
  isActive: S.Boolean,
  isSpecialProduct: S.Boolean,
  poa: S.Boolean,
}) {}

export class FulfillmentResponse extends S.Class<FulfillmentResponse>(
  "FulfillmentResponse",
)({
  data: FulfillmentInfo,
}) {}

// item location

export class InStoreLocation extends S.Class<InStoreLocation>(
  "InStoreLocation",
)({
  aisle: S.String,
  bay: S.String,
  sequence: S.String,
}) {}

export class ItemLocations extends S.Class<ItemLocations>("ItemLocations")({
  inStoreLocations: S.Array(InStoreLocation),
}) {}

export class ItemLocationResponse extends S.Class<ItemLocationResponse>(
  "ItemLocationResponse",
)({
  data: S.Array(ItemLocations),
}) {}

export class FulfillmentInfoWithLocation extends S.Class<FulfillmentInfoWithLocation>(
  "FulfillmentInfoWithLocation",
)({
  fulfillment: FulfillmentInfo,
  location: S.Option(InStoreLocation),
}) {
  get isAvailable() {
    return (
      this.fulfillment.inStorePickUpData.inStoreStockMsg ===
      "itemsAvailableInStock"
    )
  }
}
