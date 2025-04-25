import { RouterProvider, createRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useRxMount } from "@effect-rx/rx-react"
import { loginRx } from "./Search/rx"
import { productInvalidationRx } from "./Product/rx"

const router = createRouter({
  routeTree,
  defaultPreload: "render",
  defaultPendingMinMs: 0,
  scrollRestoration: true,
})

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
      <ProductInvalidation />
    </>
  )
}

function Session() {
  useRxMount(loginRx)
  return null
}

function ProductInvalidation() {
  useRxMount(productInvalidationRx)
  return null
}
