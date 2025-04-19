import { Result, useRxValue } from "@effect-rx/rx-react"
import { queryIsSetRx, resultsRx } from "./rx"
import { Cause } from "effect"

export function SearchResults() {
  const queryIsSet = useRxValue(queryIsSetRx)
  const result = useRxValue(resultsRx)

  if (!queryIsSet) {
    return null
  }

  return Result.match(result, {
    onInitial: () => <p>Loading...</p>,
    onFailure: (error) => {
      throw Cause.squash(error.cause)
    },
    onSuccess: (result) => {
      const items = result.value.items
      return (
        <div>
          <p>
            <strong>Query</strong> {String(queryIsSet)}
          </p>
          <p>
            <strong>Results</strong> {items.length}
          </p>
          <p>
            <strong>Loading</strong> {String(result.waiting)}
          </p>
          <p>
            <strong>Done</strong> {String(result.value.done)}
          </p>
        </div>
      )
    },
  })
}
