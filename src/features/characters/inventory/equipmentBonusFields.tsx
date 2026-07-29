import { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type {
  Bonus,
  BonusCollection,
  BonusTarget,
  ScopedBonusKey,
} from "../../../models/bonuses/Bonus"
import type { Equipment } from "../../../models/items/equipment/EquipmentSlot"
import type { Itemmable } from "../../../models/items/item"
import type { Attribute } from "../../../models/sheet/Attribute"
import { FormulaVariablePicker } from "../../customSystems/FormulaVariablePicker"
import { listCharacterFormulaVariables } from "../../../lib/customSystems/CharacterFormulaVariables"
import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"
import { attributeShort } from "../../../lib/attributeShorts"

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]

const TARGET_OPTIONS: Array<{ value: BonusTarget; label: string }> = [
  { value: "armorClass", label: "Classe de Armadura" },
  { value: "initiative", label: "Iniciativa" },
  { value: "maxHp", label: "HP máximo" },
  { value: "temporaryHp", label: "HP temporário" },
  { value: "passivePerception", label: "Percepção passiva" },
  { value: "attackBonus", label: "Ataques — global" },
  { value: "weaponAttackBonus", label: "Ataques com arma" },
  { value: "spellAttackBonus", label: "Ataques mágicos" },
  { value: "saveDcBonus", label: "CD — global" },
  { value: "spellSaveDcBonus", label: "CD de magias" },
  { value: "abilitySaveDcBonus", label: "CD de habilidades" },
  { value: "damageBonus", label: "Dano — global" },
  { value: "weaponDamageBonus", label: "Dano com arma" },
  { value: "spellDamageBonus", label: "Dano mágico" },
  { value: "speed", label: "Velocidade" },
  { value: "attribute", label: "Valor de atributo" },
  { value: "attributeModifier", label: "Modificador de atributo" },
]

const SCOPED_TARGETS = new Set<BonusTarget>([
  "weaponAttackBonus",
  "spellAttackBonus",
  "weaponDamageBonus",
  "spellDamageBonus",
  "spellSaveDcBonus",
  "abilitySaveDcBonus",
])

function isScopedTarget(target: BonusTarget): target is ScopedBonusKey {
  return SCOPED_TARGETS.has(target)
}

export function EquipmentBonusesFields({
  item,
  onUpdate,
}: {
  item: Itemmable
  onUpdate: (updater: (item: Itemmable) => Itemmable) => void
}) {
  const equipment = item as Equipment

  return (
    <BonusesFields
      bonuses={equipment.bonuses ?? {}}
      description="Bônus aplicados enquanto o item estiver equipado."
      onChange={(bonuses) =>
        onUpdate((current) => ({
          ...(current as Equipment),
          bonuses,
        }))
      }
    />
  )
}

export function BonusesFields({
  bonuses,
  onChange,
  description = "Bônus aplicados enquanto esta habilidade estiver disponível.",
}: {
  bonuses: BonusCollection
  onChange: (bonuses: BonusCollection) => void
  description?: string
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const entries = flattenBonuses(bonuses)

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-textH">Modificadores</div>
          <div className="mt-0.5 text-[11px] leading-4 text-textMuted">
            {description}
          </div>
        </div>

        <Button size="sm" variant="secondary" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Bônus
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-xs text-textMuted">
          Nenhum bônus configurado.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 rounded-full border border-border bg-bg py-1 pl-3 pr-1 text-xs text-textH"
            >
              <span>{entry.label}</span>
              <button
                type="button"
                aria-label={`Remover ${entry.label}`}
                onClick={() => onChange(entry.remove(bonuses))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-textMuted hover:bg-dangerBg hover:text-danger"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AddBonusDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onAdd={({ target, attribute, scopeAttribute, bonus }) => {
          if (target === "attribute" || target === "attributeModifier") {
            onChange({
              ...bonuses,
              [target]: [
                ...(bonuses[target] ?? []),
                { attribute, bonus },
              ],
            })
          } else if (isScopedTarget(target)) {
            onChange({
              ...bonuses,
              [target]: [
                ...(bonuses[target] ?? []),
                { attribute: scopeAttribute, bonus },
              ],
            })
          } else {
            onChange({
              ...bonuses,
              [target]: [...(bonuses[target] ?? []), bonus],
            })
          }
          setDialogOpen(false)
        }}
      />
    </section>
  )
}

type FlatBonusEntry = {
  id: string
  label: string
  remove: (bonuses: BonusCollection) => BonusCollection
}

export function flattenBonuses(
  bonuses: BonusCollection,
): FlatBonusEntry[] {
  const entries: FlatBonusEntry[] = []

  for (const option of TARGET_OPTIONS) {
    if (option.value === "attribute" || option.value === "attributeModifier") {
      const values = bonuses[option.value] ?? []
      values.forEach((entry, index) => {
        entries.push({
          id: `${option.value}-${index}`,
          label: `${option.label} ${attributeShort(entry.attribute)}: ${formatBonus(entry.bonus)}`,
          remove: (current) => ({
            ...current,
            [option.value]: (current[option.value] ?? []).filter(
              (_, currentIndex) => currentIndex !== index,
            ),
          }),
        })
      })
      continue
    }

    if (isScopedTarget(option.value)) {
      const values = bonuses[option.value] ?? []
      values.forEach((entry, index) => {
        const scope = entry.attribute
          ? ` ${attributeShort(entry.attribute)}`
          : " — todos os atributos"
        entries.push({
          id: `${option.value}-${index}`,
          label: `${option.label}${scope}: ${formatBonus(entry.bonus)}`,
          remove: (current) => ({
            ...current,
            [option.value]: (current[option.value] ?? []).filter(
              (_, currentIndex) => currentIndex !== index,
            ),
          }),
        })
      })
      continue
    }

    const values = bonuses[option.value] ?? []
    values.forEach((bonus, index) => {
      entries.push({
        id: `${option.value}-${index}`,
        label: `${option.label}: ${formatBonus(bonus)}`,
        remove: (current) => ({
          ...current,
          [option.value]: (current[option.value] ?? []).filter(
            (_, currentIndex) => currentIndex !== index,
          ),
        }),
      })
    })
  }

  return entries
}

function formatBonus(bonus: Bonus): string {
  const value = bonus.formula?.trim() || String(bonus.value)
  if (bonus.type === "flat") return `definir ${value}`
  if (bonus.type === "sub") return `- (${value})`
  return `+ (${value})`
}

function AddBonusDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (entry: {
    target: BonusTarget
    attribute: Attribute
    scopeAttribute?: Attribute
    bonus: Bonus
  }) => void
}) {
  const [target, setTarget] = useState<BonusTarget>("armorClass")
  const [attribute, setAttribute] = useState<Attribute>("str")
  const [scopeAttribute, setScopeAttribute] = useState<"all" | Attribute>("all")
  const [type, setType] = useState<Bonus["type"]>("add")
  const [value, setValue] = useState(1)
  const [useFormula, setUseFormula] = useState(false)
  const [formula, setFormula] = useState("")

  if (!open) return null

  const needsAttribute =
    target === "attribute" || target === "attributeModifier"
  const supportsAttributeScope = isScopedTarget(target)
  const formulaError = useFormula ? validateCharacterSheetFormula(formula) : undefined

  function close() {
    setTarget("armorClass")
    setAttribute("str")
    setScopeAttribute("all")
    setType("add")
    setValue(1)
    setUseFormula(false)
    setFormula("")
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-textH">Adicionar bônus</h2>
            <p className="mt-1 text-xs text-textMuted">
              Escolha o valor afetado e como o modificador será aplicado.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 py-4">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Afeta</span>
            <Select value={target} onChange={(event) => setTarget(event.target.value as BonusTarget)}>
              {TARGET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>

          {needsAttribute ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Atributo</span>
              <Select value={attribute} onChange={(event) => setAttribute(event.target.value as Attribute)}>
                {ATTRIBUTES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          ) : null}

          {supportsAttributeScope ? (
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Limitar ao atributo</span>
              <Select
                value={scopeAttribute}
                onChange={(event) =>
                  setScopeAttribute(event.target.value as "all" | Attribute)
                }
              >
                <option value="all">Todos os atributos</option>
                {ATTRIBUTES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </label>
          ) : null}

          <label className="flex items-center gap-2 text-xs font-medium text-textH">
            <input
              type="checkbox"
              checked={useFormula}
              onChange={(event) => setUseFormula(event.target.checked)}
            />
            Calcular o valor por fórmula
          </label>

          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Operação</span>
              <Select value={type} onChange={(event) => setType(event.target.value as Bonus["type"])}>
                <option value="add">Somar</option>
                <option value="sub">Subtrair</option>
                <option value="flat">Definir valor</option>
              </Select>
            </label>
            {!useFormula ? (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Valor</span>
                <Input type="number" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} />
              </label>
            ) : null}
          </div>

          {useFormula ? (
            <div className="grid gap-2">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-textH">Fórmula</span>
                <Input
                  value={formula}
                  placeholder="Ex.: character.level * 2 + character.proficiencyBonus"
                  onChange={(event) => setFormula(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FormulaVariablePicker
                  variables={listCharacterFormulaVariables()}
                  onSelect={(path) => setFormula((current) => current ? current + " " + path : path)}
                />
                {formulaError ? (
                  <span className="text-xs text-danger">{formulaError}</span>
                ) : (
                  <span className="text-xs text-success">Fórmula válida</span>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={close}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={Boolean(formulaError)}
            onClick={() => onAdd({
               target,
               attribute,
               scopeAttribute: scopeAttribute === "all" ? undefined : scopeAttribute,
               bonus: {
                type,
                value: Math.abs(value),
                formula: useFormula ? formula.trim() : undefined,
              },
            })}
          >
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}
