import { RouterProvider } from "@tanstack/react-router"
import { useRegisterSW } from "virtual:pwa-register/react"
import { RegistryProvider, useRxMount } from "@effect-rx/rx-react"
import { loginRx } from "./Search/rx"
import { router } from "./Router"
import { EventLogClient } from "./EventLog"

export default function App() {
  useRegisterSW({
    immediate: true,
  })

  return (
    <RegistryProvider>
      <RouterProvider router={router} />
      <Session />
    </RegistryProvider>
  )
}

function Session() {
  useRxMount(loginRx)
  useRxMount(EventLogClient.runtime)
  return null
}
