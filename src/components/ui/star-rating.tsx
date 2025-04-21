import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  rating: number
  maxRating?: number
  className?: string
  size?: "sm" | "md"
}

export function StarRating({
  rating,
  maxRating = 5,
  className,
  size = "md",
}: StarRatingProps) {
  return (
    <div
      className={cn("flex items-center", className)}
      aria-label={`Rating: ${rating} out of ${maxRating} stars`}
    >
      {[...Array(maxRating)].map((_, index) => (
        <Star
          key={index}
          className={cn(
            size === "sm" ? "h-4 w-4" : "h-5 w-5",
            "transition-colors",
            index < rating
              ? "fill-[#db2a1c] text-[#db2a1c]"
              : "fill-none text-gray-300",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  )
}
