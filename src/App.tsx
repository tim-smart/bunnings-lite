import { RouterProvider } from "@tanstack/react-router"
import { useRegisterSW } from "virtual:pwa-register/react"
import { useRxMount } from "@effect-rx/rx-react"
import { loginRx } from "./Search/rx"
import { router } from "./Router"

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
