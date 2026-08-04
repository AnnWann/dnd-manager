import { AppRouter } from "../Router";

export function UserLayout() {
  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      <AppRouter />
    </div>
  )
}