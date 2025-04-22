import { ProductBaseInfo } from "api/src/domain/Bunnings"
import { useFavoritesToggle, useIsFavorite } from "./rx"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

export function FavoriteButton({
  product,
  variant = "full",
}: {
  readonly product: ProductBaseInfo
  readonly variant?: "full" | "icon"
}) {
  const isFavorite = useIsFavorite(product)
  const toggleFavorite = useFavoritesToggle()

  if (variant === "full") {
    return (
      <Button
        className="bg-[#0D5257] hover:bg-[#0D5257]/90"
        onClick={() => toggleFavorite(product)}
      >
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
      onClick={(e) => {
        e.preventDefault()
        toggleFavorite(product)
      }}
      aria-label="Toggle favorite"
    >
      <Star
        className={cn(
          "text-[#db2a1c] cursor-pointer",
          isFavorite ? "fill-[#db2a1c]" : "fill-none",
        )}
      />
    </button>
  )
}
