type AppLoadingScreenProps = {
  title?: string
  detail?: string
}

export function AppLoadingScreen({
  title = "Preparando seu ambiente...",
  detail,
}: AppLoadingScreenProps) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[color:var(--surface-app)] px-4 text-sm text-textMuted">
      <div className="text-center">
        <div className="font-medium text-textH">{title}</div>
        {detail ? (
          <div className="mt-1 text-xs text-textMuted">{detail}</div>
        ) : null}
      </div>
    </div>
  )
}
