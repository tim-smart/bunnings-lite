import { useAtomSet } from "@effect/atom-react"
import { ProductBaseInfo } from "../../server/src/domain/Bunnings"
import { useCallback } from "react"
import * as Effect from "effect/Effect"
import * as Stream from "effect/Stream"
import { FavoritesRepo } from "@/Favorites"
import { EventLogClient } from "@/EventLog"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"

export const favoritesAtom = FavoritesRepo.runtime.atom(
  FavoritesRepo.useSync((_) => _.allReactive).pipe(Stream.unwrap),
)

export const isFavoriteAtom = Atom.family((id: string) =>
  Atom.map(favoritesAtom, (result) =>
    result.pipe(
      AsyncResult.map((favorites) => favorites.some((p) => p.id === id)),
      AsyncResult.getOrElse(() => false),
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
  { concurrent: true },
)

export const useFavoritesToggle = () => {
  const toggle = useAtomSet(toggleFavoriteAtom)
  return useCallback((product: ProductBaseInfo) => toggle(product), [toggle])
}
