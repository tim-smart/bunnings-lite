import { createRootRoute, Outlet } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="" {...{ "vaul-drawer-wrapper": "" }}>
        <Outlet />
      </div>
    </>
  ),
})
