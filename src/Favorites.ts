import { Rx, useRxSet } from "@effect-rx/rx-react"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { ProductBaseInfo } from "../api/src/domain/Bunnings"
import { Schema } from "effect"
import { useCallback } from "react"

export const favoritesRx = Rx.kvs({
  runtime: Rx.runtime(BrowserKeyValueStore.layerLocalStorage),
  key: "favorites",
  schema: Schema.Array(ProductBaseInfo),
  defaultValue: () => [],
})

export const isFavoriteRx = Rx.family((product: ProductBaseInfo) =>
  Rx.map(favoritesRx, (favorites) =>
    favorites.some((p) => p.id === product.id),
  ),
)

export const useFavoritesToggle = () => {
  const setFavorites = useRxSet(favoritesRx)

  return useCallback(
    (product: ProductBaseInfo) => {
      setFavorites((products) => {
        if (products.find((p) => p.id === product.id)) {
          return products.filter((p) => p.id !== product.id)
        }
        return [...products, product]
      })
    },
    [setFavorites],
  )
}
