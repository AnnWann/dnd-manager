export type HpDialogMode = "damage" | "heal" | "temporary"
export function CombatHpModeTabs({ mode, count, onChange }: { mode: HpDialogMode; count: number; onChange: (mode: HpDialogMode) => void }) {
  return <div className="flex flex-wrap gap-2">
    {(["damage", "heal", "temporary"] as const).map((value, index) => <button key={value} type="button"
      onClick={() => onChange(value)}
      className={["inline-flex h-9 items-center rounded-md border px-3 text-xs font-semibold",
        mode === value ? "border-accentBorder bg-accentBg text-textH" : "border-border bg-bg-subtle text-text"].join(" ")}>
      {["Dano", "Cura", "PV temp."][index]}
    </button>)}
    <span className="ml-auto self-center text-xs text-textMuted">{count} alvo{count === 1 ? "" : "s"}</span>
  </div>
}
