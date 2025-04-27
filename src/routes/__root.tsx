import {
  createRootRoute,
  Outlet,
  useRouter,
  useNavigate,
} from "@tanstack/react-router"
import { LoaderCircle, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  useRxValue,
  useRx,
  useRxSet,
  useRxSubscribe,
} from "@effect-rx/rx-react"
import { focusRx, loadingRx, queryIsSetRx, queryRx } from "@/Search/rx"
import React, { useCallback } from "react"
import { cn } from "@/lib/utils"

export const Route = createRootRoute({
  component: () => (
    <div className="flex min-h-screen flex-col bg-primary">
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

      <main className="flex-1 bg-white px-2 sm:px-4 pb-12">
        <div className="container mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  ),
})

function Logo() {
  const queryIsSet = useRxValue(queryIsSetRx)
  const setQuery = useRxSet(queryRx)
  const navigate = useNavigate()
  return (
    <img
      src="/logo.svg"
      alt="Bunnings Logo"
      width={150}
      height={50}
      className={`block transition-all ${queryIsSet ? "mt-5 h-[30px]" : "mt-20 h-[50px]"} w-auto cursor-pointer`}
      onClick={() => {
        setQuery("")
        navigate({ to: "/" })
      }}
    />
  )
}

function SearchInput() {
  const router = useRouter()
  const navigate = useNavigate()
  const [query, setQuery] = useRx(queryRx)
  const queryIsSet = query.trim() !== ""
  const inputRef = React.useRef<HTMLInputElement>(null)

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      if (router.state.location.pathname !== "/") {
        navigate({ to: "/", search: { query: e.target.value } })
      }
    },
    [setQuery, router, navigate],
  )

  useRxSubscribe(focusRx, (i) => {
    if (!inputRef.current || i === 0) return
    inputRef.current.focus({ preventScroll: true })
    inputRef.current.scrollIntoView({
      behavior: "smooth",
      block: "center",
    })
  })

  const loading = useRxValue(loadingRx)
  const Icon = loading ? LoaderCircle : Search

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <Icon
        className={cn(
          "absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground",
          loading && "animate-spin",
        )}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          inputRef.current?.blur()
        }}
      >
        <Input
          ref={inputRef}
          type="search"
          placeholder="Search for products..."
          className={`w-full h-12 pl-10 border-2 border-white rounded-md focus-visible:ring-secondary focus-visible:border-secondary bg-white ${queryIsSet ? "my-5" : "my-20"}`}
          value={query}
          onChange={onChange}
        />
      </form>
    </div>
  )
}
