import { Outlet, useLocation } from "react-router-dom"

import { UserMagicProvider } from "./UserMagicProvider"

export function UserMagicRouteBoundary() {
  const location = useLocation()
  const pathname = location.pathname

  const needsMagicRuntime =
    pathname === "/user/spells" ||
    pathname === "/user/characters/create" ||
    pathname.endsWith("/level-up") ||
    pathname.includes("/spells-list")

  if (!needsMagicRuntime) {
    return <Outlet />
  }

  return (
    <UserMagicProvider>
      <Outlet />
    </UserMagicProvider>
  )
}
