import { AppRouter } from "../Router";

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      <AppRouter />
    </div>
  )
}