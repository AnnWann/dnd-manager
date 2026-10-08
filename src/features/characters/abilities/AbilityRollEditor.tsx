import { Plus, Trash2 } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../../../models/combat/Damage"
import type { AbilityRollDefinition } from "../../../models/abilities/AbilityRoll"
import { validateAbilityRoll } from "../../../models/abilities/AbilityRoll"
import type { Attribute } from "../../../models/sheet/Attribute"
import type { Skill } from "../../../models/sheet/Skills"

const ATTRIBUTES: Array<[Attribute, string]> = [
  ["str", "Força"], ["dex", "Destreza"], ["con", "Constituição"],
  ["int", "Inteligência"], ["wis", "Sabedoria"], ["cha", "Carisma"],
]
const SKILLS: Array<[Skill, string]> = [
  ["acrobatics", "Acrobacia"], ["animalHandling", "Lidar com Animais"],
  ["arcana", "Arcanismo"], ["athletics", "Atletismo"], ["deception", "Enganação"],
  ["history", "História"], ["insight", "Intuição"], ["intimidation", "Intimidação"],
  ["investigation", "Investigação"], ["medicine", "Medicina"], ["nature", "Natureza"],
  ["perception", "Percepção"], ["performance", "Atuação"], ["persuasion", "Persuasão"],
  ["religion", "Religião"], ["sleightOfHand", "Prestidigitação"],
  ["stealth", "Furtividade"], ["survival", "Sobrevivência"],
]

const MODES: Array<[AbilityRollDefinition["kind"], string]> = [
  ["attack", "Ataque"],
  ["abilityCheck", "Teste de habilidade ou perícia"],
  ["savingThrow", "Teste de resistência do usuário"],
  ["targetSave", "Teste de resistência do alvo (CD)"],
  ["damage", "Somente dano"],
]

function defaultRoll(kind: AbilityRollDefinition["kind"] = "attack"): AbilityRollDefinition {
  return {
    kind,
    attribute: kind === "savingThrow" ? "con" : "str",
    attackType: "weapon",
    proficient: true,
    dcAttribute: "str",
    saveAttribute: "con",
    onSave: "none",
    d20Mode: "normal",
    damage: kind === "attack" || kind === "damage" ? [newDamage()] : [],
  }
}

function newDamage() {
  return { id: crypto.randomUUID(), label: "Dano", dice: "1d6" }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1 text-xs text-textMuted"><span>{label}</span>{children}</label>
}

export function AbilityRollEditor({ roll, onChange }: {
  roll?: AbilityRollDefinition
  onChange: (next: AbilityRollDefinition | undefined) => void
}) {
  function patch(values: Partial<AbilityRollDefinition>) {
    if (!roll) return
    onChange({ ...roll, ...values })
  }

  const kind = roll?.kind
  const hasD20 = kind === "attack" || kind === "abilityCheck" || kind === "savingThrow"
  const error = validateAbilityRoll(roll)

  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-border bg-bg-subtle p-3">
        <Field label="Comportamento ao usar">
          <Select value={kind ?? "none"} onChange={event => {
            const next = event.target.value
            onChange(next === "none" ? undefined : defaultRoll(next as AbilityRollDefinition["kind"]))
          }}>
            <option value="none">Sem rolagem (apenas efeito / anúncio)</option>
            {MODES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <p className="mt-2 text-xs text-textMuted">
          A ficha calcula os modificadores e o servidor resolve os dados. A rolagem aparece na aba de dados da sessão.
        </p>
      </div>

      {roll ? <>
        {hasD20 ? <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Atributo">
            <Select value={roll.attribute ?? "str"} onChange={event => patch({ attribute: event.target.value as Attribute })}>
              {ATTRIBUTES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Modo de d20">
            <Select value={roll.d20Mode ?? "normal"} onChange={event => patch({ d20Mode: event.target.value as AbilityRollDefinition["d20Mode"] })}>
              <option value="normal">Normal</option>
              <option value="advantage">Vantagem</option>
              <option value="disadvantage">Desvantagem</option>
            </Select>
          </Field>
          {kind === "attack" ? <>
            <Field label="Tipo de ataque">
              <Select value={roll.attackType ?? "weapon"} onChange={event => patch({ attackType: event.target.value as AbilityRollDefinition["attackType"] })}>
                <option value="weapon">Com arma</option>
                <option value="unarmed">Desarmado</option>
                <option value="spell">Mágico</option>
                <option value="other">Outro</option>
              </Select>
            </Field>
            <label className="flex items-center gap-2 self-end rounded-lg border border-border px-3 py-2 text-xs text-textH">
              <input type="checkbox" checked={roll.proficient !== false} onChange={event => patch({ proficient: event.target.checked })} />
              Somar proficiência ao ataque
            </label>
          </> : null}
          {kind === "abilityCheck" ? <Field label="Perícia (opcional)">
            <Select value={roll.skill ?? ""} onChange={event => patch({ skill: (event.target.value || undefined) as Skill | undefined })}>
              <option value="">Teste direto de atributo</option>
              {SKILLS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field> : null}
        </div> : null}

        {kind === "targetSave" ? <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Resistência exigida do alvo">
            <Select value={roll.saveAttribute ?? "con"} onChange={event => patch({ saveAttribute: event.target.value as Attribute })}>
              {ATTRIBUTES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="Atributo que determina a CD">
            <Select value={roll.dcAttribute ?? "str"} onChange={event => patch({ dcAttribute: event.target.value as Attribute })}>
              {ATTRIBUTES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="CD fixa (deixe vazio para 8 + proficiência + atributo)">
            <Input type="number" min={1} max={1000} value={roll.dc ?? ""} onChange={event => patch({ dc: event.target.value === "" ? undefined : Number(event.target.value) })} />
          </Field>
          <Field label="Dano em resistência bem-sucedida">
            <Select value={roll.onSave ?? "none"} onChange={event => patch({ onSave: event.target.value as AbilityRollDefinition["onSave"] })}>
              <option value="none">Nenhum</option>
              <option value="half">Metade</option>
              <option value="full">Completo</option>
            </Select>
          </Field>
        </div> : null}

        {kind !== "damage" && kind !== "targetSave" ? <Field label="Modificador adicional fixo">
          <Input type="number" value={roll.modifier ?? 0} onChange={event => patch({ modifier: Number(event.target.value) || 0 })} />
        </Field> : null}

        <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-semibold text-textH">Componentes de dano</h4>
              <p className="mt-1 text-xs text-textMuted">Cada componente possui dados e tipo independentes. Críticos dobram apenas os dados habilitados.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => patch({ damage: [...(roll.damage ?? []), newDamage()] })}>
              <Plus className="h-4 w-4" /> Dano
            </Button>
          </div>
          {(roll.damage ?? []).map((damage, index) => {
            const updateDamage = (values: Partial<typeof damage>) =>
              patch({ damage: (roll.damage ?? []).map((entry, i) => i === index ? { ...entry, ...values } : entry) })
            return <div key={damage.id} className="grid gap-3 rounded-lg border border-border bg-bg-elevated p-3">
              <div className="flex items-center gap-2">
                <Input value={damage.label ?? ""} placeholder="Nome do dano" onChange={event => updateDamage({ label: event.target.value })} />
                <Button size="sm" variant="ghost" onClick={() => patch({ damage: (roll.damage ?? []).filter((_, i) => i !== index) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dados (ex.: 2d6+3)">
                  <Input value={damage.dice} placeholder="1d6" onChange={event => updateDamage({ dice: event.target.value })} />
                </Field>
                <Field label="Tipo de dano">
                  <Select value={damage.damageType ?? ""} onChange={event => updateDamage({ damageType: (event.target.value || undefined) as DamageType | undefined })}>
                    <option value="">Não especificado</option>
                    {DAMAGE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-textH">
                <input type="checkbox" checked={damage.critical !== false} onChange={event => updateDamage({ critical: event.target.checked })} />
                Dobrar dados em acertos críticos
              </label>
            </div>
          })}
          {!roll.damage?.length ? <p className="text-xs text-textMuted">Nenhum dano adicional configurado.</p> : null}
        </section>
        {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
      </> : null}
    </div>
  )
}
