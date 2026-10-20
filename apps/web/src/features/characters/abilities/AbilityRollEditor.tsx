import type { ReactNode } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { HP_EFFECT_TYPE_OPTIONS, type HpEffectType } from "../../../models/combat/Damage"
import type { AbilityRollDefinition } from "../../../models/abilities/AbilityRoll"
import type { AbilityTargeting } from "../../../models/abilities/Ability"
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
  ["damage", "Somente dano/cura"],
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="grid min-w-0 gap-1 text-xs text-textMuted"><span>{label}</span>{children}</label>
}

export function AbilityRollEditor({ roll, onChange, targeting, onTargetingChange }: {
  roll?: AbilityRollDefinition
  onChange: (next: AbilityRollDefinition | undefined) => void
  targeting?: AbilityTargeting
  onTargetingChange?: (next: AbilityTargeting | undefined) => void
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

      {onTargetingChange ? (
        <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
          <div className="text-xs font-semibold text-textH">Aplicação automática em alvos</div>
          <p className="text-xs text-textMuted">Opcional. Sem configuração, a rolagem continua apenas informativa. Alvos podem ser personagens, participantes da iniciativa ou acompanhantes.</p>
          <Field label="Aplicar efeitos">
            <Select value={targeting?.mode ?? "none"} onChange={event => {
              const mode = event.target.value as AbilityTargeting["mode"]
              onTargetingChange(mode === "none" ? undefined : {
                mode, maxTargets: mode === "self" ? 1 : (targeting?.maxTargets ?? 1),
                radiusFeet: mode === "point" ? (targeting?.radiusFeet ?? 10) : undefined,
              })
            }}>
              <option value="none">Não configurar alvos (somente rolar)</option>
              <option value="self">Somente em si mesmo</option>
              <option value="targets">Alvos selecionados</option>
              <option value="point">Ponto / área (selecionar afetados)</option>
            </Select>
          </Field>
          {targeting?.mode === "targets" || targeting?.mode === "point" ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Máximo de afetados">
                <Input type="number" min={1} max={20} value={targeting.maxTargets ?? 1}
                  onChange={event => onTargetingChange({ ...targeting, maxTargets: Math.max(1, Math.min(20, Number(event.target.value) || 1)) })} />
              </Field>
              {targeting.mode === "point" ? (
                <Field label="Raio da área (pés)">
                  <Input type="number" min={0} max={1000} value={targeting.radiusFeet ?? 10}
                    onChange={event => onTargetingChange({ ...targeting, radiusFeet: Math.max(0, Math.min(1000, Number(event.target.value) || 0)) })} />
                </Field>
              ) : null}
            </div>
          ) : null}
          {targeting?.mode === "point" ? <p className="text-[11px] text-textMuted">O ponto é descritivo; sem coordenadas de tokens, os afetados são escolhidos manualmente.</p> : null}
        </section>
      ) : null}
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
              <h4 className="text-xs font-semibold text-textH">Componentes de dano e cura</h4>
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
                  <Select value={damage.damageType ?? ""} onChange={event => updateDamage({ damageType: (event.target.value || undefined) as HpEffectType | undefined })}>
                    <option value="">Não especificado</option>
                    {HP_EFFECT_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </Field>
              </div>
              <label className="flex items-center gap-2 text-xs text-textH">
                <input type="checkbox" checked={Boolean(damage.addAttributeModifier)} onChange={event => updateDamage({ addAttributeModifier: event.target.checked })} />
                Somar modificador do atributo ao dano
              </label>
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
