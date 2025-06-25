import { useRx, useRxSet, useRxValue } from "@effect-rx/rx-react"
import { allFilters } from "./rx"
import { useRef } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import * as Option from "effect/Option"

export function Filters() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-4 px-2 md:px-0">
      {Object.values(allFilters).map((filter) => (
        <FilterControl key={filter.filter.id} filter={filter} />
      ))}
    </div>
  )
}

type AllFilters = typeof allFilters

function FilterControl({ filter }: { filter: AllFilters[keyof AllFilters] }) {
  const range = useRxValue(filter.facet)
  const [min, setMin] = useRx(filter.min)
  const [max, setMax] = useRx(filter.max)
  const [value, setRange] = useRx(filter.value)
  const reset = useRxSet(filter.reset)

  const minInput = useRef<HTMLInputElement>(null)
  const maxInput = useRef<HTMLInputElement>(null)

  return Option.match(range, {
    onNone: () => null,
    onSome: ({ start, end }) => (
      <div className="flex flex-col">
        <Label className="text-primary">
          {filter.filter.name}:
          {Option.match(value, {
            onNone: () => null,
            onSome: () => (
              <span
                onClick={() => reset()}
                className="text-gray-600 cursor-pointer"
              >
                (clear)
              </span>
            ),
          })}
        </Label>
        <div className="h-1" />
        <div className="flex-1 flex items-center min-h-7">
          {filter.filter.kind === "slider" ? (
            <Slider
              min={Math.floor(start)}
              max={Math.ceil(end)}
              value={[
                Option.getOrElse(min, () => Math.floor(start)),
                Option.getOrElse(max, () => Math.ceil(end)),
              ]}
              onValueChange={([min, max]) => {
                setMin(min)
                setMax(max)
              }}
              onValueCommit={([min, max]) => {
                setRange(Option.some([min, max]))
              }}
              formatValue={(value) => `${filter.filter.valuePrefix}${value}`}
            />
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                minInput.current?.blur()
                maxInput.current?.blur()
                setRange(
                  Option.some([
                    Option.getOrElse(min, () => Math.floor(start)),
                    Option.getOrElse(max, () => Math.ceil(end)),
                  ]),
                )
              }}
            >
              <div className="flex gap-2 items-center">
                <Input
                  className="focus-visible:ring-secondary"
                  ref={minInput}
                  type="number"
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setMin(isNaN(value) ? Math.floor(start) : value)
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "") return
                    const value = Number(e.target.value)
                    if (isNaN(value)) return
                    setRange(
                      Option.some([
                        value,
                        Option.getOrElse(max, () => Math.ceil(end)),
                      ]),
                    )
                  }}
                  value={Option.getOrElse(min, () => "")}
                  placeholder={`${filter.filter.valuePrefix}${Math.floor(start)}`}
                />
                <div className="w-20 flex items-center">
                  <hr className="h-[5px] bg-primary w-full" />
                </div>
                <Input
                  className="focus-visible:ring-secondary"
                  ref={maxInput}
                  type="number"
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    setMax(isNaN(value) ? Math.ceil(end) : value)
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "") return
                    const value = Number(e.target.value)
                    if (isNaN(value)) return
                    setRange(
                      Option.some([
                        Option.getOrElse(min, () => Math.floor(start)),
                        value,
                      ]),
                    )
                  }}
                  value={Option.getOrElse(max, () => "")}
                  placeholder={`${filter.filter.valuePrefix}${Math.ceil(end)}`}
                />
              </div>
              <button type="submit" className="hidden">
                Submit
              </button>
            </form>
          )}
        </div>
      </div>
    ),
  })
}
