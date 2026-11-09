import { Plus, Trash2 } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { FormulaVariablePicker } from "../../customSystems/FormulaVariablePicker"
import {
  listCharacterFormulaVariables,
} from "../../../lib/customSystems/CharacterFormulaVariables"
import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  UnlockRequirements,
  UnlockVariableRequirement,
} from "../../../models/magic/spells/grantedSpellUnlocks"

function asConditions(value?: UnlockRequirements): UnlockVariableRequirement[] {
  if (value?.conditions?.length) return value.conditions
  const entries: UnlockVariableRequirement[] = []
  if (value?.minimumCharacterLevel !== undefined) {
    entries.push({ variable: "character.level", minimum: String(value.minimumCharacterLevel) })
  }
  if (value?.attribute && value.minimumAttributeScore !== undefined) {
    entries.push({
      variable: `character.attribute.${value.attribute}`,
      minimum: String(value.minimumAttributeScore),
    })
  }
  return entries
}

export function UnlockRequirementsEditor({
  value,
  onChange,
  character,
  description = "A habilidade e seus efeitos só ficam disponíveis quando todos os requisitos forem atendidos.",
}: {
  value?: UnlockRequirements
  onChange: (requirements: UnlockRequirements | undefined) => void
  character?: CharacterTemplate
  description?: string
}) {
  const variables = listCharacterFormulaVariables(character).filter(entry => entry.valueType === "number")
  const requirements = asConditions(value)
  const update = (next: UnlockVariableRequirement[]) =>
    onChange(next.length ? { conditions: next } : undefined)
  const patch = (index: number, change: Partial<UnlockVariableRequirement>) =>
    update(requirements.map((entry, i) => i === index ? { ...entry, ...change } : entry))

  return <section className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3">
    <div>
      <div className="text-xs font-semibold text-textH">Requisitos de desbloqueio (opcional)</div>
      <p className="mt-1 text-[11px] text-textMuted">{description}</p>
    </div>
    {requirements.map((entry, index) => {
      const variable = variables.find(option => option.path === entry.variable)
      const formulaError = entry.minimum.trim()
        ? validateCharacterSheetFormula(entry.minimum, character)
        : "Informe o valor mínimo."
      return <div key={index} className="grid gap-2 rounded-lg border border-border bg-bg p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-textH">Condição {index + 1}</span>
          <Button size="sm" variant="ghost" onClick={() => update(requirements.filter((_, i) => i !== index))}>
            <Trash2 className="h-4 w-4" /> Remover
          </Button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="grid gap-1">
            <span className="text-[11px] font-medium text-textMuted">Variável da ficha</span>
            <div className="text-xs text-textH break-all">{variable?.label ?? (entry.variable || "Selecione uma variável")}</div>
            <FormulaVariablePicker variables={variables} buttonLabel="Escolher variável"
              onSelect={path => patch(index, { variable: path })} />
          </div>
          <label className="grid gap-1">
            <span className="text-[11px] font-medium text-textMuted">Valor mínimo (número ou fórmula)</span>
            <Input value={entry.minimum} placeholder="Ex.: 10 + character.proficiencyBonus"
              onChange={event => patch(index, { minimum: event.target.value })} />
            <FormulaVariablePicker variables={variables} buttonLabel="Inserir variável na fórmula"
              onSelect={path => patch(index, { minimum: entry.minimum ? `${entry.minimum} + ${path}` : path })} />
          </label>
        </div>
        {!entry.variable ? <span className="text-xs text-danger">Selecione uma variável numérica.</span> : null}
        {formulaError ? <span className="text-xs text-danger">{formulaError}</span> : null}
      </div>
    })}
    <Button size="sm" variant="secondary" onClick={() => update([...requirements, { variable: "", minimum: "" }])}>
      <Plus className="h-4 w-4" /> Adicionar requisito
    </Button>
    <p className="text-[11px] text-textMuted">Todas as condições são obrigatórias (E). Ex.: Nível total ≥ 7 e Inteligência ≥ 10 + bônus de proficiência.</p>
  </section>
}
