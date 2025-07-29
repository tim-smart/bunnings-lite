import { Result, Rx, useRxSet } from "@effect-rx/rx-react"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings"
import { useCallback } from "react"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { FavoritesRepo } from "@/Favorites"
import { EventLogClient } from "@/EventLog"

export const favoritesRx = FavoritesRepo.runtime.rx(
  FavoritesRepo.use((_) => _.allReactive).pipe(Stream.unwrap),
)

export const isFavoriteRx = Rx.family((id: string) =>
  Rx.map(favoritesRx, (result) =>
    result.pipe(
      Result.map((favorites) => favorites.some((p) => p.id === id)),
      Result.getOrElse(() => false),
    ),
  ),
)

export const clearFavoritesRx = EventLogClient.runtime.fn(() =>
  EventLogClient.use((_) => _("FavoritesClear", void 0)),
)

export const toggleFavoriteRx = EventLogClient.runtime.fn(
  Effect.fnUntraced(function* (product: ProductBaseInfo, get: Rx.FnContext) {
    const client = yield* EventLogClient
    const isFavorite = get(isFavoriteRx(product.id))
    if (isFavorite) {
      yield* client("FavoriteRemove", product.id)
    } else {
      yield* client("FavoriteAdd", product)
    }
  }),
)

export const useFavoritesToggle = () => {
  const toggle = useRxSet(toggleFavoriteRx)
  return useCallback((product: ProductBaseInfo) => toggle(product), [toggle])
}
