import { RequireAuth } from "../auth/requireAuth"
import { UserMagicProvider } from "../features/magic/UserMagicProvider"
import { UserContextBoundary } from "../features/user/UserContextBoundary"
import { AppRouter } from "../Router"

export function UserLayout() {
  return (
    <RequireAuth>
      <UserMagicProvider>
        <UserContextBoundary>
          <AppRouter />
        </UserContextBoundary>
      </UserMagicProvider>
    </RequireAuth>
  )
}
