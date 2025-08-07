import { ProductBaseInfo } from "server/src/domain/Bunnings"
import { isFavoriteAtom, useFavoritesToggle } from "./atoms"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAtomValue } from "@effect-atom/atom-react"

export function FavoriteButton({
  product,
  variant = "full",
}: {
  readonly product: ProductBaseInfo
  readonly variant?: "full" | "icon"
}) {
  const isFavorite = useAtomValue(isFavoriteAtom(product.id))
  const toggleFavorite = useFavoritesToggle()

  if (variant === "full") {
    return (
      <Button onClick={() => toggleFavorite(product)}>
        <Star
          className={cn(
            "text-white cursor-pointer",
            isFavorite ? "fill-white" : "fill-none",
          )}
        />
        {isFavorite ? "Remove from favorites" : "Add to favorites"}
      </Button>
    )
  }

  return (
    <button
      type="button"
      onMouseDownCapture={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggleFavorite(product)
      }}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
      aria-label="Toggle favorite"
    >
      <Star
        className={cn(
          "text-secondary cursor-pointer",
          isFavorite ? "fill-secondary" : "fill-none",
        )}
      />
    </button>
  )
}
