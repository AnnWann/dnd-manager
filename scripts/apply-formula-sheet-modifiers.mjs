import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

function write(file, content) {
  const fullPath = path.join(root, file)
  fs.mkdirSync(path.dirname(fullPath), { recursive: true })
  fs.writeFileSync(fullPath, content)
}

function replace(file, from, to) {
  const content = read(file)
  if (!content.includes(from)) {
    throw new Error(`Trecho não encontrado em ${file}: ${from.slice(0, 120)}`)
  }
  write(file, content.replace(from, to))
}

function replaceAll(file, from, to) {
  const content = read(file)
  if (!content.includes(from)) {
    throw new Error(`Trecho não encontrado em ${file}: ${from.slice(0, 120)}`)
  }
  write(file, content.split(from).join(to))
}

const formulaRuntime = `import type { CharacterTemplate } from '../../models/characters/CharacterTemplate'
import type {
  CharacterCustomSystemState,
  CustomSystemDefinition,
} from '../../models/customSystems/CustomSystemDefinition'
import type { CustomFieldDefinition } from '../../models/customSystems/CustomFieldDefinition'
import {
  evaluateCustomFormula,
  type CustomFormulaResult,
} from './CustomFormulaEngine'
import {
  getCharacterFormulaValues,
  listCharacterFormulaVariables,
  type CharacterFormulaValues,
} from './CharacterFormulaVariables'

let evaluatingCharacterFormula = false

export function evaluateCharacterSheetFormula(
  formula: string,
  character: CharacterTemplate,
): number | undefined {
  if (!formula.trim() || evaluatingCharacterFormula) return undefined

  evaluatingCharacterFormula = true
  try {
    const result = evaluateWithValues(formula, getCharacterFormulaValues(character))
    return result.ok && typeof result.value === 'number' ? result.value : undefined
  } finally {
    evaluatingCharacterFormula = false
  }
}

export function validateCharacterSheetFormula(
  formula: string,
): string | undefined {
  if (!formula.trim()) return 'Informe uma fórmula.'

  const emptyValues: CharacterFormulaValues = Object.fromEntries(
    listCharacterFormulaVariables().map((variable) => [
      variable.path,
      variable.valueType === 'boolean' ? false : variable.valueType === 'text' ? '' : 0,
    ]),
  )
  const result = evaluateWithValues(formula, emptyValues)
  if (!result.ok) return result.error
  if (typeof result.value !== 'number') return 'A fórmula precisa resultar em um número.'
  return undefined
}

function evaluateWithValues(
  formula: string,
  values: CharacterFormulaValues,
): CustomFormulaResult {
  const replacements = Object.keys(values)
    .sort((left, right) => right.length - left.length)
    .map((variablePath) => ({
      variablePath,
      fieldId: '__sheet_' + variablePath.replace(/[^A-Za-z0-9_-]/g, '_'),
    }))

  const translated = replacements.reduce(
    (current, entry) => replaceIdentifier(
      current,
      entry.variablePath,
      'field.' + entry.fieldId,
    ),
    formula,
  )

  const fields: CustomFieldDefinition[] = replacements.map((entry) => ({
    id: entry.fieldId,
    name: entry.variablePath,
    type: typeof values[entry.variablePath] === 'boolean'
      ? 'boolean'
      : typeof values[entry.variablePath] === 'number'
        ? 'number'
        : 'text',
    editPermission: 'automaticOnly',
  }))

  const definition: CustomSystemDefinition = {
    id: '__sheet_formula__',
    name: 'Fórmula da ficha',
    version: 1,
    fields,
    resources: [],
    abilityTypes: [],
    panels: [],
    automations: [],
  }

  const state: CharacterCustomSystemState = {
    systemId: definition.id,
    systemVersion: definition.version,
    enabled: true,
    fields: Object.fromEntries(
      replacements.map((entry) => [entry.fieldId, values[entry.variablePath]]),
    ),
    resources: {},
    abilities: [],
  }

  return evaluateCustomFormula(translated, definition, state)
}

function replaceIdentifier(
  expression: string,
  identifier: string,
  replacement: string,
): string {
  const escaped = identifier.replace(/[.*+?^\${}()|[\\]\\]/g, '\\$&')
  const pattern = new RegExp(
    '(^|[^A-Za-z0-9_.-])' + escaped + '(?=$|[^A-Za-z0-9_.-])',
    'g',
  )
  return expression.replace(pattern, (_, prefix: string) => prefix + replacement)
}
`
write('src/lib/customSystems/CharacterSheetFormula.ts', formulaRuntime)

replace(
  'src/models/bonuses/Bonus.ts',
  `export type Bonus = {
  type: "add" | "sub" | "flat"
  value: number
}`,
  `export type Bonus = {
  type: "add" | "sub" | "flat"
  /** Fallback numérico e compatibilidade com bônus antigos. */
  value: number
  /** Fórmula recalculada com as variáveis atuais da ficha. */
  formula?: string
  label?: string
}`,
)

replace(
  'src/models/abilities/Ability.ts',
  `  bonuses?: BonusCollection
}`,
  `  bonuses?: BonusCollection
  /** Permite desativar modificadores sem remover a habilidade. Passivas permanecem ativas. */
  modifiersActive?: boolean
}`,
)

replace(
  'src/models/characters/CharacterCondition.ts',
  `export type ConditionDurationType =`,
  `import type { BonusCollection } from "../bonuses/Bonus"

export type ConditionDurationType =`,
)
replace(
  'src/models/characters/CharacterCondition.ts',
  `  tags: string[]
  duration: CharacterConditionDuration`,
  `  tags: string[]
  bonuses?: BonusCollection
  duration: CharacterConditionDuration`,
)

replace(
  'src/models/characters/characterConditionStorage.ts',
  `import type { CharacterTemplate } from "./CharacterTemplate"`,
  `import type { BonusCollection } from "../bonuses/Bonus"
import type { CharacterTemplate } from "./CharacterTemplate"`,
)
replace(
  'src/models/characters/characterConditionStorage.ts',
  `    tags: Array.isArray(raw.tags)
      ? raw.tags.map(readString).filter(Boolean)
      : [],
    duration: normalizeDuration(raw.duration),`,
  `    tags: Array.isArray(raw.tags)
      ? raw.tags.map(readString).filter(Boolean)
      : [],
    bonuses: normalizeBonuses(raw.bonuses),
    duration: normalizeDuration(raw.duration),`,
)
replace(
  'src/models/characters/characterConditionStorage.ts',
  `function readOptionalNumber(value: unknown): number | undefined {`,
  `function normalizeBonuses(value: unknown): BonusCollection | undefined {
  return isRecord(value) ? (value as BonusCollection) : undefined
}

function readOptionalNumber(value: unknown): number | undefined {`,
)

replace(
  'src/models/characters/characterStats.ts',
  `import type { Bonus, NormalBonusKey } from "../bonuses/Bonus"`,
  `import type { Bonus, NormalBonusKey } from "../bonuses/Bonus"
import { evaluateCharacterSheetFormula } from "../../lib/customSystems/CharacterSheetFormula"`,
)
replace(
  'src/models/characters/characterStats.ts',
  `import { getEncumbranceSpeedPenalty } from "./characterEncumbrance"`,
  `import { getEncumbranceSpeedPenalty } from "./characterEncumbrance"
import { getCharacterConditions } from "./characterConditionStorage"`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  return [
    ...(character.get("abilities") ?? []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap(
      (item) => item.abilities ?? [],
    ),
  ]`,
  `  return [
    ...(character.get("abilities") ?? []),
    ...(character.get("sheet").race.naturalAbilities ?? []),
    ...getEquippedItems(character).flatMap(
      (item) => item.abilities ?? [],
    ),
  ].filter(
    (ability) => ability.kind === "passive" || ability.modifiersActive !== false,
  )`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  return getEquippedItems(character).flatMap(
    (item) => item.bonuses?.[key] ?? [],
  )`,
  `  return getEquippedItems(character)
    .flatMap((item) => item.bonuses?.[key] ?? [])
    .map((bonus) => resolveBonus(character, bonus))`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  return getActiveAbilities(character).flatMap(
    (ability) => ability.bonuses?.[key] ?? [],
  )
}

export function getCharacterBonuses(`,
  `  return getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.[key] ?? [])
    .map((bonus) => resolveBonus(character, bonus))
}

export function getConditionBonuses(
  character: CharacterTemplate,
  key: NormalBonusKey,
): Bonus[] {
  return getCharacterConditions(character)
    .filter(isConditionActive)
    .flatMap((condition) => condition.bonuses?.[key] ?? [])
    .map((bonus) => resolveBonus(character, bonus))
}

export function getCharacterBonuses(`,
)
replace(
  'src/models/characters/characterStats.ts',
  `    ...getEquipmentBonuses(character, key),
    ...getAbilityBonuses(character, key),`,
  `    ...getEquipmentBonuses(character, key),
    ...getAbilityBonuses(character, key),
    ...getConditionBonuses(character, key),`,
)
replaceAll(
  'src/models/characters/characterStats.ts',
  `.map((entry) => entry.bonus)`,
  `.map((entry) => resolveBonus(character, entry.bonus))`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  return applyBonuses(baseValue, [
    ...equipmentBonuses,
    ...abilityBonuses,
  ])`,
  `  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  const conditionBonuses = getCharacterConditions(character)
    .filter(isConditionActive)
    .flatMap((condition) => condition.bonuses?.attribute ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  return applyBonuses(baseValue, [
    ...equipmentBonuses,
    ...abilityBonuses,
    ...conditionBonuses,
  ])`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  return applyBonuses(baseModifier, [
    ...equipmentBonuses,
    ...abilityBonuses,
  ])`,
  `  const abilityBonuses = getActiveAbilities(character)
    .flatMap((ability) => ability.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  const conditionBonuses = getCharacterConditions(character)
    .filter(isConditionActive)
    .flatMap((condition) => condition.bonuses?.attributeModifier ?? [])
    .filter((entry) => entry.attribute === attribute)
    .map((entry) => resolveBonus(character, entry.bonus))

  return applyBonuses(baseModifier, [
    ...equipmentBonuses,
    ...abilityBonuses,
    ...conditionBonuses,
  ])`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
  const weaponGeneralBonuses = weapon.bonuses?.attackBonus ?? []`,
  `  const weaponAttackBonus = weapon.bonuses?.attack?.bonus
    ? resolveBonus(character, weapon.bonuses.attack.bonus)
    : undefined
  const weaponGeneralBonuses = (weapon.bonuses?.attackBonus ?? [])
    .map((bonus) => resolveBonus(character, bonus))`,
)
replace(
  'src/models/characters/characterStats.ts',
  `  const weaponDamageBonus = weapon.bonuses?.damage?.bonus
  const weaponGeneralBonuses = weapon.bonuses?.damageBonus ?? []`,
  `  const weaponDamageBonus = weapon.bonuses?.damage?.bonus
    ? resolveBonus(character, weapon.bonuses.damage.bonus)
    : undefined
  const weaponGeneralBonuses = (weapon.bonuses?.damageBonus ?? [])
    .map((bonus) => resolveBonus(character, bonus))`,
)
replace(
  'src/models/characters/characterStats.ts',
  `export function applyBonus(baseValue: number, bonus: Bonus): number {`,
  `export function resolveBonus(
  character: CharacterTemplate,
  bonus: Bonus,
): Bonus {
  if (!bonus.formula?.trim()) return bonus
  const evaluated = evaluateCharacterSheetFormula(bonus.formula, character)
  return evaluated === undefined ? bonus : { ...bonus, value: evaluated }
}

function isConditionActive(
  condition: ReturnType<typeof getCharacterConditions>[number],
): boolean {
  if (typeof condition.duration.remaining === "number" && condition.duration.remaining <= 0) {
    return false
  }
  if (condition.duration.expiresAt) {
    const expiresAt = Date.parse(condition.duration.expiresAt)
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) return false
  }
  return true
}

export function applyBonus(baseValue: number, bonus: Bonus): number {`,
)

replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `import type { Attribute } from "../../../models/sheet/Attribute"`,
  `import type { Attribute } from "../../../models/sheet/Attribute"
import { FormulaVariablePicker } from "../../customSystems/FormulaVariablePicker"
import { listCharacterFormulaVariables } from "../../../lib/customSystems/CharacterFormulaVariables"
import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"`,
)
replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `function formatBonus(bonus: Bonus): string {
  if (bonus.type === "flat") return \`fixo \${bonus.value}\`
  if (bonus.type === "sub") return \`-\${Math.abs(bonus.value)}\`
  return \`+\${bonus.value}\`
}`,
  `function formatBonus(bonus: Bonus): string {
  const value = bonus.formula?.trim() || String(bonus.value)
  if (bonus.type === "flat") return \`definir \${value}\`
  if (bonus.type === "sub") return \`- (\${value})\`
  return \`+ (\${value})\`
}`,
)
replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `  const [type, setType] = useState<Bonus["type"]>("add")
  const [value, setValue] = useState(1)`,
  `  const [type, setType] = useState<Bonus["type"]>("add")
  const [value, setValue] = useState(1)
  const [useFormula, setUseFormula] = useState(false)
  const [formula, setFormula] = useState("")`,
)
replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `    setType("add")
    setValue(1)
    onClose()`,
  `    setType("add")
    setValue(1)
    setUseFormula(false)
    setFormula("")
    onClose()`,
)
replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `  const needsAttribute =
    target === "attribute" || target === "attributeModifier"

  function close() {`,
  `  const needsAttribute =
    target === "attribute" || target === "attributeModifier"
  const formulaError = useFormula ? validateCharacterSheetFormula(formula) : undefined

  function close() {`,
)
replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `          <div className="grid grid-cols-[1fr_120px] gap-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Operação</span>
              <Select value={type} onChange={(event) => setType(event.target.value as Bonus["type"])}>
                <option value="add">Somar</option>
                <option value="sub">Subtrair</option>
                <option value="flat">Definir valor fixo</option>
              </Select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Valor</span>
              <Input type="number" value={value} onChange={(event) => setValue(Number(event.target.value) || 0)} />
            </label>
          </div>`,
  `          <label className="flex items-center gap-2 text-xs font-medium text-textH">
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
          ) : null}`,
)
replace(
  'src/features/characters/inventory/equipmentBonusFields.tsx',
  `            variant="primary"
            onClick={() => onAdd({
              target,
              attribute,
              bonus: { type, value: Math.abs(value) },
            })}`,
  `            variant="primary"
            disabled={Boolean(formulaError)}
            onClick={() => onAdd({
              target,
              attribute,
              bonus: {
                type,
                value: Math.abs(value),
                formula: useFormula ? formula.trim() : undefined,
              },
            })}`,
)

replace(
  'src/features/customSystems/FormulaVariablePicker.tsx',
  `className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3"`,
  `className="fixed inset-0 z-[13000] flex items-center justify-center bg-black/60 p-3"`,
)

replace(
  'src/features/characters/abilities/abilityDialog.tsx',
  `    bonuses: {},
  }`,
  `    bonuses: {},
    modifiersActive: true,
  }`,
)
replace(
  'src/features/characters/abilities/abilityDialog.tsx',
  `          <BonusesFields
            bonuses={draft.bonuses ?? {}}`,
  `          <label className="flex items-center gap-2 rounded-xl border border-border bg-bg-subtle p-3 text-xs font-medium text-textH">
            <input
              type="checkbox"
              checked={draft.kind === "passive" || draft.modifiersActive !== false}
              disabled={draft.kind === "passive"}
              onChange={(event) => setDraft({ ...draft, modifiersActive: event.target.checked })}
            />
            Manter modificadores desta habilidade ativos
          </label>

          <BonusesFields
            bonuses={draft.bonuses ?? {}}`,
)

replace(
  'src/features/characters/characterSheet/characterConditions.tsx',
  `import { Textarea } from "../../../components/ui/Textarea"`,
  `import { Textarea } from "../../../components/ui/Textarea"
import { BonusesFields } from "../inventory/equipmentBonusFields"`,
)
replace(
  'src/features/characters/characterSheet/characterConditions.tsx',
  `          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Etiquetas</span>`,
  `          <div className="sm:col-span-2">
            <BonusesFields
              bonuses={draft.bonuses ?? {}}
              description="Modificadores aplicados enquanto esta condição estiver ativa e não expirada."
              onChange={(bonuses) => patch({ bonuses })}
            />
          </div>

          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs text-text">Etiquetas</span>`,
)
replace(
  'src/features/characters/characterSheet/characterConditions.tsx',
  `    tags: [],
    createdAt: new Date().toISOString(),`,
  `    tags: [],
    bonuses: {},
    createdAt: new Date().toISOString(),`,
)

console.log('Formula sheet modifiers applied successfully.')
