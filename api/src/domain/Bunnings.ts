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
  systitle: S.String,
  stockindicator: S.String,
  thumbnailimageurl: S.String,
  supercategoriescode: S.Array(S.String),
  sysuri: S.String,
  isactive: S.String,
  systransactionid: S.Number,
  supercategoriesurl: S.Array(S.String),
  supercategories: S.Array(S.String),
  ratingcount: S.Number,
  permanentid: S.String,
  variantcount: S.Number,
  brandiconurl: S.optional(S.String),
  title: S.String,
  currency: S.String,
  moreoptions: S.String,
  storeattributes_9454: S.String,
  colorcount: S.Number,
  trustedseller: S.String,
  unitofprice: S.String,
  productranges_9454: S.optional(S.Array(S.String)),
  rating: S.Number,
  size: S.Number,
  brandcode: S.optional(S.Array(S.String)),
  categories: S.Array(S.String),
  brandname: S.optional(S.String),
  name: S.String,
  itemnumber: S.String,
  basecolor: S.optional(S.Union(S.Null, S.String)),
  price_9454: S.Number,
  imageurl: S.String,
  uri: S.String,
}) {}

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
