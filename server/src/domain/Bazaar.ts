import * as Effect from "effect/Effect"
import * as S from "effect/Schema"

class RatingDistribution extends S.Class<RatingDistribution>(
  "RatingDistribution",
)({
  RatingValue: S.Number,
  Count: S.Number,
}) {}

class ReviewStatistics extends S.Class<ReviewStatistics>("ReviewStatistics")({
  AverageOverallRating: S.optional(S.NullOr(S.Number)).pipe(
    S.withDecodingDefault(Effect.succeed(0)),
  ),
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
  Results: S.Array(ReviewStats),
}) {}

// ratings

export class ProductReview extends S.Class<ProductReview>("ProductReview")({
  Id: S.String,
  UserLocation: S.NullOr(S.String),
  IsFeatured: S.Boolean,
  Rating: S.Number,
  ModerationStatus: S.String,
  SubmissionTime: S.DateTimeUtcFromString,
  ReviewText: S.String,
  Title: S.NullOr(S.String),
  UserNickname: S.NullOr(S.String),
}) {}

export class ReviewsResponse extends S.Class<ReviewsResponse>(
  "ReviewsResponse",
)({
  Limit: S.Number,
  Offset: S.Number,
  TotalResults: S.Number,
  Results: S.Array(ProductReview),
}) {}

export class ReviewsWithStats extends S.Class<ReviewsWithStats>(
  "ReviewsWithStats",
)({
  reviews: S.Array(ProductReview),
  stats: ReviewStats,
}) {}
