import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { Ability, AbilityManualInput } from "../../../models/abilities/Ability"
import { validateAbilityInputDefinitions, validateAbilityInputReferences } from "../../../models/abilities/abilityManualInputs"

export function AbilityManualInputsEditor({ ability, onChange }: { ability: Ability; onChange: (ability: Ability) => void }) {
  const inputs = ability.manualInputs ?? []
  const update = (index: number, patch: Partial<AbilityManualInput>) => onChange({ ...ability,
    manualInputs: inputs.map((input, i) => i === index ? { ...input, ...patch } : input) })
  const error = validateAbilityInputDefinitions(inputs) ?? validateAbilityInputReferences(ability)
  return <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-xs font-semibold text-textH">Valores informados ao usar</h3>
        <p className="mt-1 text-xs text-textMuted">Entradas externas pedidas a cada ativação. Não gastam espaços de magia ou outros recursos.</p></div>
      <Button size="sm" variant="secondary" disabled={inputs.length >= 12} onClick={() => {
        let n = 1
        while (inputs.some(input => input.id === `valor${n}`)) n++
        onChange({ ...ability, manualInputs: [...inputs, { id: `valor${n}`, label: `Valor ${n}`, min: 0, max: 100000 }] })
      }}>+ Entrada</Button>
    </div>
    {!inputs.length ? <Button size="sm" variant="secondary" onClick={() => onChange({ ...ability,
      effectDuration: "instant", effectPersistence: "untilEnd", benefitsActive: false,
      manualInputs: [
        { id: "nivelMagia", label: "Nível da magia", min: 1, max: 9, defaultValue: 1 },
        { id: "multiplicador", label: "Multiplicador da cura (2 ou 3)", min: 2, max: 3, defaultValue: 2 },
      ],
      bonuses: { ...ability.bonuses, onUseHp: [...(ability.bonuses?.onUseHp ?? []), { kind: "heal", bonus: { type: "add", value: 0, formula: "input.nivelMagia * input.multiplicador" } }] },
    })}>Exemplo: Colheita Sinistra</Button> : null}
    {inputs.map((input, index) => <div key={index} className="grid gap-2 rounded-lg border border-border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-textMuted">Nome exibido<Input value={input.label} onChange={e => update(index, { label: e.target.value })} /></label>
        <label className="grid gap-1 text-xs text-textMuted">Identificador (sem espaços)<Input value={input.id} onChange={e => update(index, { id: e.target.value })} /></label>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {([['min', 'Mínimo'], ['max', 'Máximo'], ['defaultValue', 'Valor inicial (opcional)']] as const).map(([key, label]) =>
          <label key={key} className="grid gap-1 text-xs text-textMuted">{label}<Input type="number" step="any" value={input[key] ?? ""}
            onChange={e => update(index, { [key]: e.target.value === "" ? undefined : Number(e.target.value) })} /></label>)}
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-textMuted"><code>input.{input.id}</code>
        <Button size="sm" variant="ghost" onClick={() => onChange({ ...ability, manualInputs: inputs.filter((_, i) => i !== index) })}>Remover entrada</Button></div>
    </div>)}
    <p className="text-xs text-textMuted">Em Bônus, escolha Fórmula e use o seletor de variáveis. Ex.: input.nivelMagia * input.multiplicador. Valores de efeitos duradouros ficam associados à ativação.</p>
    {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
  </section>
}
