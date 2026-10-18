type Option<T extends string> = { value: T; label: string }
export type CustomClassBasicValues<THitDie extends string, TCaster extends string, TAttribute extends string, TMode extends string> = {
  name: string; hitDie: THitDie; skillChoices: number; casterType: TCaster; castingAttribute: TAttribute; knownSpellMode: TMode
}
export function CustomClassBasicFields<THitDie extends string, TCaster extends string, TAttribute extends string, TMode extends string>({
  value, hitDice, casterTypes, attributes, spellModes, noneCasterValue, disabled, onChange,
}: {
  value: CustomClassBasicValues<THitDie, TCaster, TAttribute, TMode>
  hitDice: readonly THitDie[]
  casterTypes: readonly Option<TCaster>[]
  attributes: readonly Option<TAttribute>[]
  spellModes: readonly Option<TMode>[]
  noneCasterValue: TCaster
  disabled: boolean
  onChange: (patch: Partial<CustomClassBasicValues<THitDie, TCaster, TAttribute, TMode>>) => void
}) {
  const classes = "h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH disabled:opacity-60"
  return <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <label className="grid gap-1.5 sm:col-span-2 lg:col-span-1">
      <span className="text-xs font-medium text-textH">Nome da classe</span>
      <input className={classes} disabled={disabled} value={value.name} onChange={event => onChange({name: event.target.value})} />
    </label>
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-textH">Dado de vida</span>
      <select className={classes} disabled={disabled} value={value.hitDie} onChange={event => onChange({hitDie: event.target.value as THitDie})}>
        {hitDice.map(die => <option key={die} value={die}>{die}</option>)}
      </select>
    </label>
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-textH">Perícias de classe</span>
      <input className={classes} disabled={disabled} type="number" min={0} max={18} value={value.skillChoices}
        onChange={event => onChange({skillChoices: Math.max(0, Math.min(18, Math.trunc(Number(event.target.value) || 0)))})}/>
    </label>
    <label className="grid gap-1.5">
      <span className="text-xs font-medium text-textH">Tipo de conjurador</span>
      <select className={classes} disabled={disabled} value={value.casterType} onChange={event => onChange({casterType: event.target.value as TCaster})}>
        {casterTypes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
    {value.casterType !== noneCasterValue ? <>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-textH">Atributo de conjuração</span>
        <select className={classes} disabled={disabled} value={value.castingAttribute} onChange={event => onChange({castingAttribute: event.target.value as TAttribute})}>
          {attributes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-medium text-textH">Modelo de magias</span>
        <select className={classes} disabled={disabled} value={value.knownSpellMode} onChange={event => onChange({knownSpellMode: event.target.value as TMode})}>
          {spellModes.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </> : null}
  </div>
}
