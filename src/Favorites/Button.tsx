import { ProductBaseInfo } from "../../server/src/domain/Bunnings.ts"
import { isFavoriteAtom, useFavoritesToggle } from "./atoms"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAtomValue } from "@effect/atom-react"

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
      <Button
        variant="outline"
        size="lg"
        aria-pressed={isFavorite}
        onClick={() => toggleFavorite(product)}
      >
        <Star
          className={cn(
            "text-secondary transition-transform",
            isFavorite ? "fill-secondary scale-110" : "fill-none",
          )}
        />
        {isFavorite ? "Unfavorite" : "Favorite"}
      </Button>
    )
  }

  return (
    <button
      type="button"
      className="grid size-9 cursor-pointer place-items-center rounded-full bg-white/90 transition-[background-color,transform] hover:bg-muted active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
      aria-pressed={isFavorite}
    >
      <Star
        className={cn(
          "size-5 text-secondary",
          isFavorite ? "fill-secondary" : "fill-none",
        )}
      />
    </button>
  )
}
