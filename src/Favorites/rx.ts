import { Favorites } from "@/Favorites"
import { Result, Rx, useRxRef, useRxValue } from "@effect-rx/rx-react"
import { ProductBaseInfo } from "api/src/domain/Bunnings"
import { Effect } from "effect"
import { useCallback, useMemo } from "react"

const runtime = Rx.runtime(Favorites.Default)

export const favoritesRefRx = runtime.rx(Effect.map(Favorites, (_) => _.ref))

export const useFavoritesRef = () =>
  Result.getOrThrow(useRxValue(favoritesRefRx))

export const useFavorites = () => {
  const ref = useFavoritesRef()
  return useRxRef(ref)
}

export const useIsFavorite = (product: ProductBaseInfo) => {
  const favorites = useFavorites()
  return useMemo(
    () => favorites.some((p) => p.id === product.id),
    [favorites, product],
  )
}

export const useFavoritesToggle = () => {
  const ref = useFavoritesRef()

  return useCallback(
    (product: ProductBaseInfo) => {
      ref.update((products) => {
        if (products.find((p) => p.id === product.id)) {
          return products.filter((p) => p.id !== product.id)
        }
        return [...products, product]
      })
    },
    [ref],
  )
}
