import { RequireAuth } from "../auth/requireAuth"
import { UserContextBoundary } from "../features/user/UserContextBoundary"
import { UserDataProvider } from "../features/user/UserDataProvider"
import { AppRouter } from "../Router"

export function UserLayout() {
  return (
    <RequireAuth>
      <UserDataProvider>
        <UserContextBoundary>
          <AppRouter />
        </UserContextBoundary>
      </UserDataProvider>
    </RequireAuth>
  )
}
