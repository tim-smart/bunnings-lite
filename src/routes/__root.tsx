import {
  createRootRoute,
  Outlet,
  useRouter,
  useNavigate,
} from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useRxValue, useRx } from "@effect-rx/rx-react"
import { queryIsSetRx, queryRx } from "@/Search/rx"
import React, { useCallback } from "react"

export const Route = createRootRoute({
  component: () => (
    <div className="flex min-h-screen flex-col bg-[#0D5257]">
      <header>
        <div className="flex">
          <div className="flex-1"></div>
          <Logo />
          <div className="flex-1"></div>
        </div>

        <div className="px-4">
          <SearchInput />
        </div>
      </header>

      <main className="flex-1 bg-white px-4">
        <div className="container mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>
    </div>
  ),
})

function Logo() {
  const queryIsSet = useRxValue(queryIsSetRx)
  return (
    <img
      src="/logo.svg"
      alt="Bunnings Logo"
      width={150}
      height={50}
      className={`block transition-all ${queryIsSet ? "mt-5 h-[30px]" : "mt-20 h-[50px]"} w-auto`}
    />
  )
}

function SearchInput() {
  const router = useRouter()
  const navigate = useNavigate()
  const [query, setQuery] = useRx(queryRx)
  const queryIsSet = query.trim() !== ""

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      if (router.state.location.pathname !== "/") {
        navigate({ to: "/", search: { query: e.target.value } })
      }
    },
    [setQuery, router, navigate],
  )

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search for products..."
        className={`w-full h-12 pl-10 border-2 border-white rounded-md focus-visible:ring-[#db2a1c] focus-visible:border-[#db2a1c] bg-white ${queryIsSet ? "my-5" : "my-20"}`}
        value={query}
        onChange={onChange}
      />
    </div>
  )
}
