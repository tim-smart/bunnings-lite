import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useRxMount } from "@effect-rx/rx-react"
import { loginRx } from "./Search/rx"

const router = createRouter({ routeTree, scrollRestoration: true })

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

export default function App() {
  useRegisterSW({
    immediate: true,
  })

  return (
    <>
      <RouterProvider router={router} />
      <Session />
    </>
  )
}

function Session() {
  useRxMount(loginRx)
  return null
}
