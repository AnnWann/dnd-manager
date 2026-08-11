import { Plus, Trash2 } from "lucide-react"

import { FormulaVariablePicker } from "./FormulaVariablePicker"
import {
  listCustomFormulaVariables,
  validateCustomFormula,
} from "../../lib/customSystems"
import type { AbilityActionKind } from "../../models/abilities/Ability"
import type { ConditionDurationType } from "../../models/characters/CharacterCondition"
import type { CustomAbilityResourceChangeDefinition } from "../../models/customSystems/CustomAbilityDefinition"
import type {
  CustomNativeStatOverrideDefinition,
  CustomNativeStatTarget,
  CustomSystemActionDefinition,
  CustomSystemConditionChangeDefinition,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"

const STAT_OPTIONS: Array<{ value: CustomNativeStatTarget; label: string }> = [
  { value: "initiative", label: "Iniciativa" },
  { value: "armorClass", label: "Classe de Armadura" },
  { value: "mobility", label: "Mobilidade" },
  { value: "passivePerception", label: "Percepção passiva" },
]

const ACTION_OPTIONS: Array<{ value: AbilityActionKind | ""; label: string }> = [
  { value: "", label: "Não exibir como ação" },
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
  { value: "free", label: "Ação livre" },
  { value: "legendaryAction", label: "Ação lendária" },
  { value: "legendaryReaction", label: "Reação lendária" },
  { value: "legendaryResistance", label: "Resistência lendária" },
]

const DURATION_OPTIONS: Array<{
  value: ConditionDurationType
  label: string
}> = [
  { value: "permanent", label: "Permanente" },
  { value: "rounds", label: "Rodadas" },
  { value: "turns", label: "Turnos" },
  { value: "minutes", label: "Minutos" },
  { value: "hours", label: "Horas" },
  { value: "days", label: "Dias" },
  { value: "until-start-of-turn", label: "Até o início do turno" },
  { value: "until-end-of-turn", label: "Até o fim do turno" },
  { value: "until-save", label: "Até passar em um teste" },
  { value: "concentration", label: "Concentração" },
  { value: "custom", label: "Personalizada" },
]

const NATIVE_RESOURCES = [
  ["hitPoints", "Pontos de vida"],
  ["temporaryHitPoints", "Pontos de vida temporários"],
  ["inspiration", "Inspiração"],
  ["exhaustion", "Exaustão"],
] as const

type Props = {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
  definitions: CustomSystemDefinition[]
}

export function CustomSystemSheetIntegrationEditor({
  draft,
  setDraft,
  definitions,
}: Props) {
  const overrides = draft.nativeStatOverrides ?? []
  const actions = draft.actions ?? []

  return (
    <div className="grid gap-5">
      <section className="rounded-xl border border-border bg-bg p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-textH">
              Fórmulas da ficha nativa
            </h2>
            <p className="mt-1 text-sm leading-6 text-text">
              Substitua o cálculo automático de um valor existente enquanto este
              sistema estiver ativo. Use modificadores de atributo quando quiser
              algo como SAB + DEX.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                nativeStatOverrides: [
                  ...overrides,
                  newStatOverride(overrides),
                ],
              })
            }
            className="inline-flex items-center gap-2 rounded-lg border border-accent px-3 py-2 text-sm text-accent hover:bg-accentBg"
          >
            <Plus className="h-4 w-4" /> Fórmula
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-accentBorder bg-accentBg/30 p-3 text-xs leading-5 text-text">
          Exemplo de Iniciativa = SAB + DEX:{" 