import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/unstable/http"
import { Array, Effect, Option, Stream } from "effect"
import { ProductsResponse, ReviewsResponse } from "./domain/Bazaar.ts"
import { NodeHttpClient } from "@effect/platform-node"
import * as Context from "effect/Context"
import * as Layer from "effect/Layer"

export class Bazaar extends Context.Service<Bazaar>()("api/Bazaar", {
  make: Effect.gen(function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.mapRequest(
        HttpClientRequest.prependUrl("https://api.bazaarvoice.com/data"),
      ),
    )

    const overview = (id: string) =>
      client
        .get("/products.json", {
          urlParams: {
            resource: "products",
            filter: `id:eq:${id}`,
            filter_reviews: "contentlocale:eq:en*,en_NZ,en_NZ",
            filter_questions: "contentlocale:eq:en*,en_NZ,en_NZ",
            filter_answers: "contentlocale:eq:en*,en_NZ,en_NZ",
            filter_reviewcomments: "contentlocale:eq:en*,en_NZ,en_NZ",
            filteredstats: "Reviews, questions, answers",
            stats: "Reviews, questions, answers",
            passkey: "caUZMUAJ5mm8n5r7EtVHRt5QhZFVEPcUKge0N3CDWAZFc",
            apiversion: "5.5",
            displaycode: "10414-en_nz",
          },
        })
        .pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(ProductsResponse)),
          Effect.map((_) => Array.head(_.Results)),
          Effect.withSpan("Bazaar.overview", { attributes: { id } }),
        )

    const reviewsPage = (id: string, offset: number) =>
      client
        .get("/reviews.json", {
          urlParams: {
            resource: "reviews",
            action: "REVIEWS_N_STATS",
            filter: [
              `productid:eq:${id}`,
              "contentlocale:eq:en*,en_NZ,en_NZ",
              "isratingsonly:eq:false",
            ],
            filter_reviews: "contentlocale:eq:en*,en_NZ,en_NZ",
            filteredstats: "reviews",
            Stats: "Reviews",
            limit: 9,
            offset: offset,
            limit_comments: 3,
            sort: "helpfulness:desc,totalpositivefeedbackcount:desc",
            passkey: "caUZMUAJ5mm8n5r7EtVHRt5QhZFVEPcUKge0N3CDWAZFc",
            apiversion: "5.5",
            displaycode: "10414-en_nz",
          },
        })
        .pipe(
          Effect.flatMap(HttpClientResponse.schemaBodyJson(ReviewsResponse)),
          Effect.withSpan("Bazaar.reviewsPage", { attributes: { id, offset } }),
        )

    const reviews = (id: string) =>
      Stream.paginate(0, (offset) =>
        reviewsPage(id, offset).pipe(
          Effect.map(
            (res) =>
              [
                res.Results,
                Option.some(res.Results.length + offset).pipe(
                  Option.filter((_) => _ < res.TotalResults),
                ),
              ] as const,
          ),
        ),
      ).pipe(Stream.withSpan("Bazaar.reviews", { attributes: { id } }))

    const allReviews = (id: string) =>
      Stream.runCollect(reviews(id)).pipe(
        Effect.withSpan("Bazaar.allReviews", { attributes: { id } }),
      )

    return { overview, reviews, allReviews } as const
  }),
}) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(NodeHttpClient.layerUndici),
  )
}
