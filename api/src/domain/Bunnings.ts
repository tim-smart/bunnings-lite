import { Context, DateTime, Schema, Schema as S } from "effect"

export class CurrentSession extends Context.Tag(
  "domain/Bunnings/CurrentSession",
)<CurrentSession, Session>() {}

export class Session extends Schema.Class<Session>("domain/Bunnings/Session")({
  expires: Schema.DateTimeUtcFromNumber,
  token: Schema.String,
}) {
  static fromJson = Schema.decode(Schema.parseJson(Session))

  get expired() {
    return this.expires.pipe(
      DateTime.subtract({ hours: 1 }),
      DateTime.lessThan(DateTime.unsafeNow()),
    )
  }
}

export class SearchResult extends S.Class<SearchResult>("SearchResult")({
  thumbnailimageurl: S.String,
  isactive: S.String,
  ratingcount: S.Number,
  permanentid: S.String,
  title: S.String,
  productroutingurl: S.String,
  rating: S.Number,
  size: S.Number,
  name: S.String,
  price_9454: S.Number,
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
      price: this.price_9454,
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
  classifications: S.Array(Classification),
  code: S.String,
  configurable: S.Boolean,
  coveoCategoriesPath: S.String,
  customMade: S.Boolean,
  defaultVariant: S.Boolean,
  dimension: Dimension,
  disableCategories: S.Boolean,
  feature: DataFeature,
  forHire: S.Boolean,
  fsc: S.Boolean,
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
