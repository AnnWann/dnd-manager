import { RequireAuth } from "../auth/requireAuth"
import { UserMagicProvider } from "../features/magic/UserMagicProvider"
import { UserContextBoundary } from "../features/user/UserContextBoundary"
import { UserDataProvider } from "../features/user/UserDataProvider"
import { AppRouter } from "../Router"

export function UserLayout() {
  return (
    <RequireAuth>
      <UserDataProvider>
        <UserMagicProvider>
          <UserContextBoundary>
            <AppRouter />
          </UserContextBoundary>
        </UserMagicProvider>
      </UserDataProvider>
    </RequireAuth>
  )
}
