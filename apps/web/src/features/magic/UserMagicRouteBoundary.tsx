import { Outlet } from "react-router-dom"

/**
 * Kept as a routing boundary for compatibility with the existing route tree.
 * UserMagicProvider now lives at /user layout scope so navigation never
 * remounts or reloads the user's spell context.
 */
export function UserMagicRouteBoundary() {
  return <Outlet />
}
