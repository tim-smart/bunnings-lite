import { createRootRoute, Outlet, useNavigate } from "@tanstack/react-router"
import { LoaderCircle, Search, Settings2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  useAtomValue,
  useAtom,
  useAtomSet,
  useAtomSubscribe,
} from "@effect/atom-react"
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
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { identityStringAtom, remoteUrlAtom } from "@/EventLog"
import * as Option from "effect/Option"
import * as Atom from "effect/reactivity/Atom"
import { CopyInviteButton, InviteDialog } from "@/Sync/Invite"

export const Route = createRootRoute({
  component: () => (
    <div className="flex min-h-screen flex-col bg-brand">
      <Header />

      <main className="flex-1 bg-canvas px-3 sm:px-6 pb-24">
        <div className="container mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  ),
})

function Header() {
  const minimize = useAtomValue(minimizeAtom)
  return (
    <header className="px-3 sm:px-6 text-white">
      <InviteDialog />
      <div
        className={cn(
          "container mx-auto max-w-7xl grid grid-cols-[1fr_auto_1fr] items-center gap-x-6",
          minimize
            ? "py-3 gap-y-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:py-4"
            : "pt-4 pb-12 gap-y-10 md:pb-16 md:gap-y-12",
        )}
      >
        <div
          className={cn(
            "row-start-1",
            minimize
              ? "col-start-1 justify-self-start"
              : "col-start-2 justify-self-center pt-8 md:pt-12",
          )}
        >
          <Logo />
        </div>
        <div className="col-start-3 row-start-1 self-start justify-self-end">
          <SettingsPanel />
        </div>
        <div
          className={cn(
            "col-span-3 row-start-2",
            minimize && "md:col-span-1 md:col-start-2 md:row-start-1",
          )}
        >
          <SearchInput />
        </div>
      </div>
    </header>
  )
}

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
      className={cn(
        "block w-auto cursor-pointer transition-[height,opacity] hover:opacity-90 active:opacity-80",
        minimize ? "h-[30px] md:h-[34px]" : "h-[50px] md:h-[60px]",
      )}
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
    <div
      className={cn(
        "relative w-full mx-auto",
        minimize ? "max-w-2xl" : "max-w-xl",
      )}
    >
      <Icon
        className={cn(
          "pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-primary",
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
          className={cn(
            "w-full pl-12 pr-4 border-2 border-card rounded-lg bg-card text-base md:text-base hover:border-card focus-visible:border-secondary focus-visible:ring-3 focus-visible:ring-secondary/20",
            minimize ? "h-11 md:h-12" : "h-13 md:h-14 md:text-lg",
          )}
          value={query}
          onChange={onChange}
          autoFocus
        />
      </form>
    </div>
  )
}

function SettingsPanel() {
  const identityString = useAtomValue(identityStringAtom)
  const [remoteUrlReal, setRemoteUrlReal] = useAtom(remoteUrlAtom)
  const remoteUrlString = Option.match(remoteUrlReal, {
    onNone: () => "",
    onSome: (url) => url.toString(),
  })
  const [remoteUrl, setRemoteUrl] = useState(remoteUrlString)
  return (
    <Drawer
      // Settings can change while closed, e.g. by accepting an invite
      onOpenChange={(open) => {
        if (open) setRemoteUrl(remoteUrlString)
      }}
    >
      <DrawerTrigger
        aria-label="Sync settings"
        className="grid size-10 cursor-pointer place-items-center rounded-full text-white/90 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <Settings2 className="size-5" />
      </DrawerTrigger>
      <DrawerContent className="max-w-md mx-auto">
        <DrawerHeader>
          <DrawerTitle>Sync settings</DrawerTitle>
          <DrawerDescription>
            Keep your favourites in step across devices.
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Remote URL
            <Input
              id="remote-url"
              placeholder="https://"
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

          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Identity
            <Input
              id="identity"
              value={identityString}
              // Switching identity discards local data, so it goes through
              // the invite prompt instead
              readOnly
            />
          </label>

          <CopyInviteButton />
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
