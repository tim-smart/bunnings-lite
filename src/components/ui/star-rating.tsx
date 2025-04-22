import { Star, StarHalf } from "lucide-react"
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
      {[...Array(maxRating)].map((_, index) => {
        if (index >= maxRating) {
          return <EmptyStar key={index} size={size} />
        }
        const isHalfStar = rating % 1 !== 0 && index + 1 === Math.ceil(rating)
        const StarC = isHalfStar ? StarHalf : Star
        const inner = (
          <StarC
            key={index}
            className={cn(
              isHalfStar ? "absolute top-0 left-0" : "relative",
              size === "sm" ? "h-4 w-4" : "h-5 w-5",
              "transition-colors",
              index < rating
                ? "fill-[#db2a1c] text-[#db2a1c]"
                : "fill-none text-gray-300",
            )}
            aria-hidden="true"
          />
        )
        if (!isHalfStar) {
          return inner
        }
        return (
          <div
            key={index}
            className={cn("relative", size === "sm" ? "h-4 w-4" : "h-5 w-5")}
          >
            {inner}
            <EmptyStar size={size} />
          </div>
        )
      })}
    </div>
  )
}

function EmptyStar({ size }: { size: "sm" | "md" }) {
  return (
    <Star
      className={cn(
        size === "sm" ? "h-4 w-4" : "h-5 w-5",
        "transition-colors",
        "fill-none text-gray-300",
      )}
      aria-hidden="true"
    />
  )
}
