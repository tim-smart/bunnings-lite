import { RouterProvider } from "@tanstack/react-router"
import { useRegisterSW } from "virtual:pwa-register/react"
import { RegistryProvider, useAtomMount } from "@effect-atom/atom-react"
import { loginAtom } from "./Search/atoms"
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
  useAtomMount(loginAtom)
  useAtomMount(EventLogClient.runtime)
  return null
}
