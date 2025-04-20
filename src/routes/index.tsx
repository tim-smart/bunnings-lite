import { createFileRoute } from "@tanstack/react-router"
import { SearchResults } from "@/Search/SearchResults"

export const Route = createFileRoute("/")({
  component: SearchPage,
})

export function SearchPage() {
  return <SearchResults />
}
