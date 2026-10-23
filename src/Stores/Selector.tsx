import {
  RegistryContext,
  useAtomRefresh,
  useAtomSet,
  useAtomValue,
} from "@effect/atom-react"
import { allStoresAtom, currentLocationAtom, storesAtom } from "./atoms"
import { Check, MapPin, Search } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useContext, useMemo, useState, type ReactNode } from "react"
import { SessionLocation, Store } from "../../server/src/domain/Bunnings"
import { Skeleton } from "@/components/ui/skeleton"
import * as Option from "effect/Option"
import * as AsyncResult from "effect/reactivity/AsyncResult"
import * as Array from "effect/Array"
import * as Order from "effect/Order"

// Select value for the item that opens the store search
const searchValue = "search"

// Radix focuses items on hover as well as from the keyboard, and the browser
// counts both as focus-visible. Track which one is in use so hover stays a
// neutral highlight and only keyboard focus gets a ring.
const itemClassName =
  "py-3 cursor-pointer focus:bg-muted focus:text-primary [&>span:first-child_svg]:text-primary group-data-[input=keyboard]/stores:focus:ring-2 group-data-[input=keyboard]/stores:focus:ring-inset group-data-[input=keyboard]/stores:focus:ring-primary"

export function StoreSelector() {
  const registry = useContext(RegistryContext)
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const [input, setInput] = useState<"keyboard" | "pointer">("pointer")
  const currentLocation = useAtomValue(currentLocationAtom)
  const setLocation = useAtomSet(currentLocationAtom)
  return (
    <div className="w-full">
      <Select
        onOpenChange={setOpen}
        open={open}
        value={Option.match(currentLocation, {
          onNone: () => "",
          onSome: (location) => String(location.code),
        })}
        onValueChange={(value) => {
          if (value === searchValue) {
            setSearching(true)
            return
          }
          registry.get(storesAtom).pipe(
            AsyncResult.value,
            Option.flatMap(Array.findFirst((store) => store.name === value)),
            Option.map((store) => {
              setLocation(Option.some(SessionLocation.fromStore(store)))
            }),
          )
        }}
      >
        <SelectTrigger
          className="w-full cursor-pointer border-input bg-white font-medium text-foreground shadow-none hover:border-primary/40 focus-visible:border-primary focus-visible:ring-primary/15 data-[size=default]:h-11 data-[state=open]:border-primary"
          onKeyDown={() => setInput("keyboard")}
          onPointerDown={() => setInput("pointer")}
        >
          <div className="flex items-center">
            <MapPin className="size-5 mr-2 text-secondary" />
            <SelectValue placeholder="Select your store" />
          </div>
        </SelectTrigger>
        <SelectContent
          className="group/stores"
          data-input={input}
          onKeyDown={() => setInput("keyboard")}
          onPointerMove={() => setInput("pointer")}
        >
          <SelectGroup>
            <SelectLabel className="font-bold">Select your store</SelectLabel>
            {open ? (
              <StoreItems currentLocation={currentLocation} />
            ) : (
              <CurrentLocationItem currentLocation={currentLocation} />
            )}
          </SelectGroup>
          <SelectSeparator />
          <SelectItem value={searchValue} className={itemClassName}>
            <Search />
            Search all stores
          </SelectItem>
        </SelectContent>
      </Select>
      <StoreSearch
        open={searching}
        onOpenChange={setSearching}
        currentLocation={currentLocation}
        onSelect={(store) => {
          setLocation(Option.some(SessionLocation.fromStore(store)))
          setSearching(false)
        }}
      />
    </div>
  )
}

function CurrentLocationItem({
  currentLocation,
}: {
  readonly currentLocation: Option.Option<SessionLocation>
}) {
  return Option.match(currentLocation, {
    onNone: () => null,
    onSome: (location) => (
      <SelectItem value={location.code} className={itemClassName}>
        {location.city}
      </SelectItem>
    ),
  })
}

function StoreItems({
  currentLocation,
}: {
  readonly currentLocation: Option.Option<SessionLocation>
}) {
  return AsyncResult.builder(useAtomValue(storesAtom))
    .onSuccess((stores) => (
      <>
        {/* Keep a store chosen by search visible when it isn't nearby */}
        {stores.some((store) =>
          Option.exists(currentLocation, (_) => _.code === store.name),
        ) ? null : (
          <CurrentLocationItem currentLocation={currentLocation} />
        )}
        {stores.length === 0 ? (
          <StoreItemsNote>No stores found near you.</StoreItemsNote>
        ) : null}
        {Array.Array.from(stores, (store) => (
          <SelectItem
            key={store.name}
            value={store.name}
            className={itemClassName}
          >
            {store.displayName}
          </SelectItem>
        ))}
      </>
    ))
    .onFailure(() => (
      <>
        <CurrentLocationItem currentLocation={currentLocation} />
        <StoreItemsNote>Couldn't find stores near you.</StoreItemsNote>
      </>
    ))
    .orElse(() => (
      <>
        <CurrentLocationItem currentLocation={currentLocation} />
        {Array.makeBy(5, (i) => (
          <Skeleton key={i} className="h-8 flex-1 m-2" />
        ))}
      </>
    ))
}

function StoreItemsNote({ children }: { readonly children: ReactNode }) {
  return (
    <p
      role="status"
      className="max-w-(--radix-select-trigger-width) px-2 py-3 text-sm text-muted-foreground"
    >
      {children}
    </p>
  )
}

function StoreSearch({
  open,
  onOpenChange,
  currentLocation,
  onSelect,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly currentLocation: Option.Option<SessionLocation>
  readonly onSelect: (store: Store) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-w-md mx-auto h-[80vh]">
        <DrawerHeader>
          <DrawerTitle>Find your store</DrawerTitle>
          <DrawerDescription>
            Search Bunnings stores in New Zealand and Australia.
          </DrawerDescription>
        </DrawerHeader>
        {open ? (
          <StoreSearchResults
            currentLocation={currentLocation}
            onSelect={onSelect}
          />
        ) : null}
      </DrawerContent>
    </Drawer>
  )
}

function StoreSearchResults({
  currentLocation,
  onSelect,
}: {
  readonly currentLocation: Option.Option<SessionLocation>
  readonly onSelect: (store: Store) => void
}) {
  const [query, setQuery] = useState("")
  const retry = useAtomRefresh(allStoresAtom)
  const result = useAtomValue(allStoresAtom)
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="px-4 pb-2 relative">
        <Search className="absolute left-7 top-1/2 -translate-y-1/2 -mt-1 size-4 text-muted-foreground" />
        <Input
          autoFocus
          type="search"
          aria-label="Search stores"
          placeholder="Store, suburb or postcode"
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="overflow-y-auto flex-1 px-4 pb-safe">
        {AsyncResult.builder(result)
          .onSuccess((stores) => (
            <StoreList
              stores={stores}
              query={query}
              currentLocation={currentLocation}
              onSelect={onSelect}
            />
          ))
          .onFailure(() => (
            <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
              <p role="status">Couldn't load stores.</p>
              <Button variant="outline" onClick={retry}>
                Try again
              </Button>
            </div>
          ))
          .orElse(() =>
            Array.makeBy(8, (i) => <Skeleton key={i} className="h-12 my-2" />),
          )}
      </div>
    </div>
  )
}

function StoreList({
  stores,
  query,
  currentLocation,
  onSelect,
}: {
  readonly stores: ReadonlyArray<Store>
  readonly query: string
  readonly currentLocation: Option.Option<SessionLocation>
  readonly onSelect: (store: Store) => void
}) {
  const index = useMemo(
    () =>
      stores.map((store) => ({
        store,
        text: [
          store.displayName,
          store.address.town,
          store.address.postalCode,
          store.storeRegion,
          store.address.country.name,
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [stores],
  )
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const matches = index
    .filter(({ text }) => terms.every((term) => text.includes(term)))
    .map(({ store }) => store)
  const countries = Array.groupBy(
    matches,
    (store) => store.address.country.name,
  )

  if (matches.length === 0) {
    return (
      <p
        role="status"
        className="py-8 text-center text-sm text-muted-foreground"
      >
        No stores match “{query.trim()}”.
      </p>
    )
  }

  return Object.entries(countries).map(([country, stores]) => (
    <section key={country} aria-label={country} className="pb-4">
      <h3 className="sticky top-0 bg-background py-2 text-sm font-semibold text-primary">
        {country}
      </h3>
      <ul className="flex flex-col">
        {Array.sortWith(stores, (store) => store.displayName, Order.String).map(
          (store) => {
            const selected = Option.exists(
              currentLocation,
              (_) => _.code === store.name,
            )
            return (
              <li key={store.name}>
                <button
                  type="button"
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect(store)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <MapPin className="size-4 shrink-0 text-secondary" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-medium text-primary">
                      {store.displayName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {store.address.formattedAddress}
                    </span>
                  </span>
                  {selected ? <Check className="size-4 text-primary" /> : null}
                </button>
              </li>
            )
          },
        )}
      </ul>
    </section>
  ))
}
