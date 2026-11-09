import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { UnlockRequirements } from "../../../models/magic/spells/grantedSpellUnlocks"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "Força" },
  { value: "dex", label: "Destreza" },
  { value: "con", label: "Constituição" },
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

export function UnlockRequirementsEditor({
  value,
  onChange,
}: {
  value?: UnlockRequirements
  onChange: (requirements: UnlockRequirements | undefined) => void
}) {
  const update = (next: UnlockRequirements) =>
    onChange(next.minimumCharacterLevel === undefined && !next.attribute ? undefined : next)

  return <section className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3">
    <div className="text-xs font-semibold text-textH">Requisitos de desbloqueio (opcional)</div>
    <p className="text-xs text-textMuted">A habilidade e seus efeitos só ficam disponíveis quando todos os requisitos forem atendidos.</p>
    <label className="grid gap-1 text-xs text-textMuted md:max-w-48">
      Nível mínimo do personagem
      <Input type="number" min={1} max={20} placeholder="Sem requisito"
        value={value?.minimumCharacterLevel ?? ""}
        onChange={event => {
          const raw = event.target.value
          update({ ...value, minimumCharacterLevel: raw ? Math.max(1, Math.min(20, Math.trunc(Number(raw) || 1))) : undefined })
        }} />
    </label>
    <div className="grid gap-2 md:grid-cols-2">
      <label className="grid gap-1 text-xs text-textMuted">
        Atributo exigido
        <Select value={value?.attribute ?? ""}
          onChange={event => {
            const attribute = event.target.value as Attribute | ""
            update({ ...value, attribute: attribute || undefined, minimumAttributeScore: attribute ? value?.minimumAttributeScore ?? 10 : undefined })
          }}>
          <option value="">Nenhum</option>
          {ATTRIBUTES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </Select>
      </label>
      {value?.attribute ? <label className="grid gap-1 text-xs text-textMuted">
        Valor mínimo do atributo
        <Input type="number" min={1} max={30} value={value.minimumAttributeScore ?? 10}
          onChange={event => update({ ...value, minimumAttributeScore: Math.max(1, Math.min(30, Math.trunc(Number(event.target.value) || 1))) })} />
      </label> : null}
    </div>
  </section>
}
