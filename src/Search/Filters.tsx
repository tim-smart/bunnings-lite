import { useAtom, useAtomSet, useAtomValue } from "@effect/atom-react"
import { allFilters } from "./atoms"
import { useRef } from "react"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import * as Option from "effect/Option"

export function Filters() {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-xl bg-card px-4 py-3 sm:grid-cols-2 sm:gap-y-4 sm:px-6 sm:py-4 lg:grid-cols-[minmax(0,26rem)_minmax(0,22rem)]">
      {Object.values(allFilters).map((filter) => (
        <FilterControl key={filter.filter.id} filter={filter} />
      ))}
    </div>
  )
}

type AllFilters = typeof allFilters

function FilterControl({ filter }: { filter: AllFilters[keyof AllFilters] }) {
  const range = useAtomValue(filter.facet)
  const [min, setMin] = useAtom(filter.min)
  const [max, setMax] = useAtom(filter.max)
  const [value, setRange] = useAtom(filter.value)
  const reset = useAtomSet(filter.reset)

  const minInput = useRef<HTMLInputElement>(null)
  const maxInput = useRef<HTMLInputElement>(null)

  return Option.match(range, {
    onNone: () => null,
    onSome: ({ start, end }) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex min-h-5 items-center justify-between gap-2">
          <Label className="text-foreground font-semibold">
            {filter.filter.name}
          </Label>
          {Option.match(value, {
            onNone: () => null,
            onSome: () => (
              <button
                type="button"
                onClick={() => reset()}
                className="cursor-pointer rounded-sm text-sm text-muted-foreground underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                (clear)
              </button>
            ),
          })}
        </div>
        <div className="flex-1 flex items-center min-h-10 px-1 sm:px-0">
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
              className="w-full"
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
              <div className="flex gap-3 items-center">
                <Input
                  aria-label={`Minimum ${filter.filter.name.toLowerCase()}`}
                  inputMode="decimal"
                  className="tabular-nums"
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
                <span className="shrink-0 text-sm text-muted-foreground">
                  to
                </span>
                <Input
                  aria-label={`Maximum ${filter.filter.name.toLowerCase()}`}
                  inputMode="decimal"
                  className="tabular-nums"
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
