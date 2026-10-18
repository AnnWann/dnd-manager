export type ClassConfigurationChoice<T extends string> = { id: T; name: string; level: number }
export function ClassConfigurationSelector<T extends string>({
  choices, selectedId, onSelect,
}: { choices: readonly ClassConfigurationChoice<T>[]; selectedId: T; onSelect: (value: T) => void }) {
  if (choices.length <= 1) return null
  return <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
    <div className="text-sm font-semibold text-textH">Classes personalizadas</div>
    <p className="mt-1 text-xs leading-5 text-textMuted">Selecione qual classe do multiclass você deseja configurar.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {choices.map(choice => <button key={choice.id} type="button" aria-pressed={selectedId === choice.id}
        onClick={() => onSelect(choice.id)}
        className={["rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors",
          selectedId === choice.id ? "border-accentBorder bg-accentBg text-textH" : "border-border bg-bg-subtle text-text hover:bg-accentBg"].join(" ")}>
        <span>{choice.name}</span><span className="ml-2 font-normal text-textMuted">Nível {choice.level}</span>
      </button>)}
    </div>
  </section>
}
