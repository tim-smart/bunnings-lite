import {
  RegistryContext,
  Result,
  useRxSet,
  useRxValue,
} from "@effect-rx/rx-react"
import { currentLocationRx, storesRx } from "./rx"
import { MapPin } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useContext, useState } from "react"
import { SessionLocation } from "../../server/src/domain/Bunnings"
import { Skeleton } from "@/components/ui/skeleton"
import * as Option from "effect/Option"
import * as Chunk from "effect/Chunk"

export function StoreSelector() {
  const registry = useContext(RegistryContext)
  const [open, setOpen] = useState(false)
  const currentLocation = useRxValue(currentLocationRx)
  const setLocation = useRxSet(currentLocationRx)
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
          registry.get(storesRx).pipe(
            Result.value,
            Option.flatMap(Chunk.findFirst((store) => store.name === value)),
            Option.map((store) => {
              setLocation(Option.some(SessionLocation.fromStore(store)))
            }),
          )
        }}
      >
        <SelectTrigger className="w-full border-2 border-primary text-primary rounded-md focus:ring-primary">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-secondary" />
            <SelectValue placeholder="Select your store" />
          </div>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel className="font-bold">Select your store</SelectLabel>
            {open ? (
              <StoreItems currentLocation={currentLocation} />
            ) : (
              Option.match(currentLocation, {
                onNone: () => null,
                onSome: (location) => (
                  <SelectItem
                    value={location.code}
                    className="py-3 cursor-pointer hover:bg-gray-100"
                  >
                    {location.city}
                  </SelectItem>
                ),
              })
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function StoreItems({
  currentLocation,
}: {
  readonly currentLocation: Option.Option<SessionLocation>
}) {
  return Result.builder(useRxValue(storesRx))
    .onSuccess((stores) => (
      <>
        {Array.from(stores, (store) => (
          <SelectItem
            key={store.name}
            value={store.name}
            className="py-3 cursor-pointer hover:bg-gray-100"
          >
            {store.displayName}
          </SelectItem>
        ))}
      </>
    ))
    .orElse(() => (
      <>
        {Option.match(currentLocation, {
          onNone: () => null,
          onSome: (location) => (
            <SelectItem
              value={location.code}
              className="py-3 cursor-pointer hover:bg-gray-100"
            >
              {location.city}
            </SelectItem>
          ),
        })}
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 flex-1 m-2" />
        ))}
      </>
    ))
}
