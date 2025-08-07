import { Result, Atom, useAtomSet } from "@effect-atom/atom-react"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings"
import { useCallback } from "react"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { FavoritesRepo } from "@/Favorites"
import { EventLogClient } from "@/EventLog"

export const favoritesAtom = FavoritesRepo.runtime.atom(
  FavoritesRepo.use((_) => _.allReactive).pipe(Stream.unwrap),
)

export const isFavoriteAtom = Atom.family((id: string) =>
  Atom.map(favoritesAtom, (result) =>
    result.pipe(
      Result.map((favorites) => favorites.some((p) => p.id === id)),
      Result.getOrElse(() => false),
    ),
  ),
)

export const clearFavoritesAtom = EventLogClient.runtime.fn(() =>
  EventLogClient.use((_) => _("FavoritesClear", void 0)),
)

export const toggleFavoriteAtom = EventLogClient.runtime.fn(
  Effect.fnUntraced(function* (product: ProductBaseInfo, get: Atom.FnContext) {
    const client = yield* EventLogClient
    const isFavorite = get(isFavoriteAtom(product.id))
    if (isFavorite) {
      yield* client("FavoriteRemove", product.id)
    } else {
      yield* client("FavoriteAdd", product)
    }
  }),
)

export const useFavoritesToggle = () => {
  const toggle = useAtomSet(toggleFavoriteAtom)
  return useCallback((product: ProductBaseInfo) => toggle(product), [toggle])
}
