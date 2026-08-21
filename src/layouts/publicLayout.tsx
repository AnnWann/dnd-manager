import { PublicRouter } from "../PublicRouter"

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-[color:var(--surface-app)] text-text">
      <PublicRouter />
    </div>
  )
}
