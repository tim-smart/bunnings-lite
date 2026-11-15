import { Effect, Layer, Schema, Stream } from "effect"
import { Loader } from "@effect/ui"
import { ProductBaseInfo } from "../../../server/src/domain/Bunnings.ts"
import { KnownProducts } from "../../product/services/KnownProducts.ts"
import { Favorites } from "../services/Favorites.ts"

/** The favourites, newest first. */
export class ListFavorites extends Loader.Service<ListFavorites>()(
  "favorites/ListFavorites",
  {
    args: {},
    success: Schema.Array(ProductBaseInfo),
    error: Schema.Never,
    staleTime: "1 hour",
  },
  Effect.gen(function* () {
    const favorites = yield* Favorites
    const known = yield* KnownProducts
    return () =>
      Effect.tap(favorites.all, (products) =>
        Effect.sync(() => known.remember(products)),
      )
  }),
) {}

/**
 * Refetches the favourites after each change to them. A change can come from
 * another device at any time, so no Command can declare it.
 */
export const ListFavoritesRefresh = Layer.effectDiscard(
  Effect.gen(function* () {
    const favorites = yield* Favorites
    const context = yield* Effect.context<Loader.Cache>()
    yield* favorites.changes.pipe(
      Stream.runForEach(() =>
        Effect.provide(ListFavorites.invalidate(), context),
      ),
      Effect.forkScoped,
    )
  }),
)
