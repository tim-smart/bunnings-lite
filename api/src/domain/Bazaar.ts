import * as S from "effect/Schema"

class RatingDistribution extends S.Class<RatingDistribution>(
  "RatingDistribution",
)({
  RatingValue: S.Number,
  Count: S.Number,
}) {}

class ReviewStatistics extends S.Class<ReviewStatistics>("ReviewStatistics")({
  AverageOverallRating: S.optionalWith(S.Number, {
    default: () => 0,
    nullable: true,
  }),
  FeaturedReviewCount: S.Number,
  RatingsOnlyReviewCount: S.Number,
  TotalReviewCount: S.Number,
  RatingDistribution: S.Array(RatingDistribution),
}) {}

export class ReviewStats extends S.Class<ReviewStats>("ReviewStats")({
  Id: S.String,
  ReviewStatistics: ReviewStatistics,
  TotalReviewCount: S.Number,
  FilteredReviewStatistics: ReviewStatistics,
}) {}

export class ProductsResponse extends S.Class<ProductsResponse>(
  "ProductsResponse",
)({
  Results: S.NonEmptyArray(ReviewStats),
}) {}

// ratings

export class ProductReview extends S.Class<ProductReview>("ProductReview")({
  Id: S.String,
  UserLocation: S.Union(S.Null, S.String),
  IsFeatured: S.Boolean,
  Rating: S.Number,
  ModerationStatus: S.String,
  SubmissionTime: S.DateTimeUtc,
  ReviewText: S.String,
  Title: S.String,
  UserNickname: S.Union(S.Null, S.String),
}) {}

export class ReviewsResponse extends S.Class<ReviewsResponse>(
  "ReviewsResponse",
)({
  Limit: S.Number,
  Offset: S.Number,
  TotalResults: S.Number,
  Results: S.Chunk(ProductReview),
}) {}

export class ReviewsWithStats extends S.Class<ReviewsWithStats>(
  "ReviewsWithStats",
)({
  reviews: S.Array(ProductReview),
  stats: ReviewStats,
}) {}
