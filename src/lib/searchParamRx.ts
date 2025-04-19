import { Rx } from "@effect-rx/rx-react"

export const makeSearchParamRx = (name: string) =>
  Rx.writable(
    () => {
      const searchParams = new URLSearchParams(window.location.search)
      const value = searchParams.get(name) || ""
      return value
    },
    (ctx, value: string) => {
      const searchParams = new URLSearchParams(window.location.search)
      if (value) {
        searchParams.set(name, value)
      } else {
        searchParams.delete(name)
      }
      const newUrl = `${window.location.pathname}?${searchParams.toString()}`
      window.history.pushState({}, "", newUrl)
      ctx.setSelf(value)
    },
  )
