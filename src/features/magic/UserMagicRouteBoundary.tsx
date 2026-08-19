import { Outlet } from "react-router-dom"

import { UserMagicProvider } from "./UserMagicProvider"

export function UserMagicRouteBoundary() {
  return (
    <UserMagicProvider>
      <Outlet />
    </UserMagicProvider>
  )
}
