import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  rating: number
  maxRating?: number
  className?: string
}

export function StarRating({
  rating,
  maxRating = 5,
  className,
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
            "h-5 w-5 transition-colors",
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
