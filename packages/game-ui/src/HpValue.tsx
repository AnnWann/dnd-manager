type HpValueProps = { label: string; value: number; variant?: "compact" | "summary" }

/** Read-only HP value with no session or character dependencies. */
export function HpValue({ label, value, variant = "compact" }: HpValueProps) {
  const summary = variant === "summary"
  return (
    <div className={summary
      ? "rounded-lg border border-border bg-bg-subtle p-3 text-center"
      : "rounded-lg border border-border bg-bg-subtle px-2 py-2 text-center"}>
      <div className="text-[10px] uppercase tracking-wide text-textMuted">{label}</div>
      <div className={summary
        ? "mt-1 text-xl font-semibold text-textH"
        : "mt-1 text-lg font-semibold text-textH"}>{value}</div>
    </div>
  )
}
