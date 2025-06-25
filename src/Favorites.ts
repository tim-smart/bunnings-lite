import { Rx, useRxSet } from "@effect-rx/rx-react"
import { ProductBaseInfo } from "../server/src/domain/Bunnings"
import { useCallback } from "react"
import * as Schema from "effect/Schema"
import * as BrowserKeyValueStore from "@effect/platform-browser/BrowserKeyValueStore"

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
        return [product, ...products]
      })
    },
    [setFavorites],
  )
}
