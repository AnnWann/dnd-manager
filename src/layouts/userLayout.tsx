import { UserMagicProvider } from "../features/magic/UserMagicProvider"
import { AppRouter } from "../Router"

export function UserLayout() {
  return (
    <UserMagicProvider>
      <AppRouter />
    </UserMagicProvider>
  )
}
