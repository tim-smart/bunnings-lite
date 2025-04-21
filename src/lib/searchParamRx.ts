import { Rx } from "@effect-rx/rx-react"

export const makeSearchParamRx = (name: string) =>
  Rx.writable(
    (get) => {
      const searchParams = new URLSearchParams(window.location.search)
      const value = searchParams.get(name) || ""
      // listen to popstate events to update the value
      const handlePopState = () => {
        const searchParams = new URLSearchParams(window.location.search)
        const newValue = searchParams.get(name) || ""
        if (newValue !== value) {
          get.setSelfSync(newValue)
        }
      }
      window.addEventListener("popstate", handlePopState)
      get.addFinalizer(() =>
        window.removeEventListener("popstate", handlePopState),
      )
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
