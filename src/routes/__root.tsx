import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { LoaderCircle, Search, Settings2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  useAtomValue,
  useAtom,
  useAtomSet,
  useAtomSubscribe,
  Atom,
} from "@effect-atom/atom-react"
import {
  focusAtom,
  loadingAtom,
  queryIsSetAtom,
  queryAtom,
} from "@/Search/atoms"
import React, { useCallback, useState } from "react"
import { cn } from "@/lib/utils"
import { locationAtom } from "@/Router"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { identityStringAtom, remoteUrlAtom } from "@/EventLog"
import * as Option from "effect/Option"

export const Route = createRootRoute({
  component: () => (
    <div className="flex min-h-screen flex-col bg-primary">
      <header>
        <SettingsPanel />

        <div className="flex">
          <div className="flex-1"></div>
          <Logo />
          <div className="flex-1"></div>
        </div>

        <div className="px-4">
          <SearchInput />
        </div>
      </header>

      <main className="flex-1 bg-white px-2 sm:px-4 pb-18">
        <div className="container mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  ),
})

const minimizeAtom = Atom.make((get) => {
  const path = get(locationAtom).pathname
  return path !== "/" || get(queryIsSetAtom)
})

function Logo() {
  const minimize = useAtomValue(minimizeAtom)
  const setQuery = useAtomSet(queryAtom)
  const navigate = useNavigate()
  return (
    <img
      src="/logo.svg"
      alt="Bunnings Logo"
      width={150}
      height={50}
      className={`block transition-all ${minimize ? "mt-5 h-[30px]" : "mt-20 h-[50px]"} w-auto cursor-pointer`}
      onClick={() => {
        setQuery("")
        navigate({ to: "/" })
      }}
    />
  )
}

function SearchInput() {
  const navigate = useNavigate()
  const [query, setQuery] = useAtom(queryAtom)
  const minimize = useAtomValue(minimizeAtom)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      if (location.pathname !== "/") {
        navigate({ to: "/", search: { query: e.target.value } })
      }
    },
    [setQuery, location, navigate],
  )

  useAtomSubscribe(focusAtom, (i) => {
    if (!inputRef.current || i === 0) return
    inputRef.current.focus({ preventScroll: true })
    window.scroll({
      top: 0,
      behavior: "smooth",
    })
  })

  const loading = useAtomValue(loadingAtom)
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
          className={`w-full h-12 pl-10 border-2 border-white rounded-md focus-visible:ring-secondary focus-visible:border-secondary bg-white ${minimize ? "my-5" : "my-20"}`}
          value={query}
          onChange={onChange}
          autoFocus
        />
      </form>
    </div>
  )
}

function SettingsPanel() {
  const [identityString, setIdentityString] = useAtom(identityStringAtom)
  const [remoteUrlReal, setRemoteUrlReal] = useAtom(remoteUrlAtom)
  const [remoteUrl, setRemoteUrl] = useState(
    Option.match(remoteUrlReal, {
      onNone: () => "",
      onSome: (url) => url.toString(),
    }),
  )
  return (
    <Drawer
      onClose={() =>
        setRemoteUrl(
          Option.match(remoteUrlReal, {
            onNone: () => "",
            onSome: (url) => url.toString(),
          }),
        )
      }
    >
      <DrawerTrigger>
        <Settings2 className="text-white absolute top-3 right-3 cursor-pointer" />
      </DrawerTrigger>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader>
          <DrawerTitle>Sync settings</DrawerTitle>
        </DrawerHeader>
        <div className="p-3 flex flex-col gap-4">
          <label className="text-sm">
            Remote URL
            <Input
              id="identity"
              value={remoteUrl}
              onChange={(e) => {
                const trimmed = e.target.value.trim()
                if (trimmed === "") {
                  setRemoteUrlReal(Option.none())
                } else {
                  const url = URL.parse(trimmed)
                  if (url) {
                    setRemoteUrlReal(Option.some(url))
                  }
                }
                setRemoteUrl(e.target.value)
              }}
            />
          </label>

          <label className="text-sm">
            Identity
            <Input
              id="identity"
              value={identityString}
              onChange={(e) => setIdentityString(e.target.value)}
            />
          </label>
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
