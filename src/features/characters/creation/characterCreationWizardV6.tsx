import {
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
} from "react"

import "../../../models/leveling/ExpandedClassProgression"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Itemmable } from "../../../models/items/item"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { materializeProgressionChoices } from "../../../models/leveling/materializeProgressionChoices"
import { refreshProgressionFeatureMechanics } from "../../../models/leveling/refreshProgressionFeatureMechanics"
import type { RacialAttributeBonusRule } from "../../../models/races/CharacterRace"
import { ProgressionFeatureModalEnhancer } from "../progression/ProgressionFeatureModalEnhancer"
import { ProgressionModalInstantSelectionBridge } from "../progression/ProgressionModalInstantSelectionBridge"
import { ProgressionSpellSelectionModal } from "../progression/ProgressionSpellSelectionModal"
import {
  CharacterCreationAbilityScoreRules,
  type AbilityScoreOverride,
} from "./CharacterCreationAbilityScoreRules"
import {
  CharacterCreationBackgroundChoices,
  type BackgroundChoiceOverride,
} from "./CharacterCreationBackgroundChoices"
import {
  CharacterCreationEquipmentChoicesStable,
  type EquipmentOverride,
} from "./CharacterCreationEquipmentChoicesStable"
import {
  CharacterCreationGenericRacialChoices,
  type GenericRacialChoiceOverride,
} from "./CharacterCreationGenericRacialChoices"
import {
  CharacterCreationRacialChoices,
  type RacialChoiceOverride,
} from "./CharacterCreationRacialChoices"
import { CreationRequiredFieldHighlighter } from "./CreationRequiredFieldHighlighter"
import { CreationSpellGrantLocalizationBridge } from "./CreationSpellGrantLocalizationBridge"
import {
  FinalCharacterIdentityDialog,
  type FinalCharacterIdentity,
} from "./FinalCharacterIdentityDialog"
import { IntegratedCharacterCreationWizard } from "./IntegratedCharacterCreationWizard"
import type { CharacterCreationProgressionPlan } from "./characterCreationWizardV5"

export type { CharacterCreationProgressionPlan } from "./characterCreationWizardV5"

type PendingCreation = {
  character: CharacterTemplate
  plan: CharacterCreationProgressionPlan
}

export function CharacterCreationWizard(
  props: ComponentProps<typeof IntegratedCharacterCreationWizard>,
) {
  const [equipmentOverride, setEquipmentOverride] =
    useState<EquipmentOverride | null>(null)
  const [abilityScoreOverride, setAbilityScoreOverride] =
    useState<AbilityScoreOverride | null>(null)
  const [racialChoiceOverride, setRacialChoiceOverride] =
    useState<RacialChoiceOverride | null>(null)
  const [genericRacialOverride, setGenericRacialOverride] =
    useState<GenericRacialChoiceOverride | null>(null)
  const [backgroundChoiceOverride, setBackgroundChoiceOverride] =
    useState<BackgroundChoiceOverride | null>(null)
  const [racialChoiceError, setRacialChoiceError] = useState("")
  const [backgroundChoiceError, setBackgroundChoiceError] = useState("")
  const [blockingError, setBlockingError] = useState("")
  const [pendingCreation, setPendingCreation] =
    useState<PendingCreation | null>(null)

  const clearErrors = useCallback(() => {
    setBlockingError("")
    setRacialChoiceError("")
    setBackgroundChoiceError("")
  }, [])

  useEffect(() => {
    if (!props.open) {
      clearErrors()
      setEquipmentOverride(null)
      setAbilityScoreOverride(null)
      setRacialChoiceOverride(null)
      setGenericRacialOverride(null)
      setBackgroundChoiceOverride(null)
      setPendingCreation(null)
      return
    }

    const onInteraction = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      if (event.type === "input" || event.type === "change") {
        clearErrors()
        return
      }

      const button = target.closest("button")
      if (!button) return
      const text = button.textContent?.trim() ?? ""
      const isNavigation =
        text === "Voltar" ||
        text === "Continuar" ||
        /^\d+\./.test(text)
      if (isNavigation) clearErrors()
    }

    document.addEventListener("input", onInteraction, true)
    document.addEventListener("change", onInteraction, true)
    document.addEventListener("click", onInteraction, true)
    return () => {
      document.removeEventListener("input", onInteraction, true)
      document.removeEventListener("change", onInteraction, true)
      document.removeEventListener("click", onInteraction, true)
    }
  }, [clearErrors, props.open])

  const handleEquipmentChange = useCallback(
    (next: EquipmentOverride | null) => {
      if (!next) return
      setEquipmentOverride(next)
      if (next.valid) setBlockingError("")
    },
    [],
  )
  const handleAbilityScoreChange = useCallback(
    (next: AbilityScoreOverride | null) => {
      if (!next) return
      setAbilityScoreOverride(next)
      setBlockingError("")
    },
    [],
  )
  const handleRacialChoiceChange = useCallback(
    (next: RacialChoiceOverride | null) => {
      if (!next) return
      setRacialChoiceOverride(next)
      if (next.valid) clearErrors()
    },
    [clearErrors],
  )
  const handleGenericRacialChange = useCallback(
    (next: GenericRacialChoiceOverride | null) => {
      if (!next) return
      setGenericRacialOverride(next)
      if (next.valid) clearErrors()
    },
    [clearErrors],
  )
  const handleBackgroundChoiceChange = useCallback(
    (next: BackgroundChoiceOverride | null) => {
      if (!next) return
      setBackgroundChoiceOverride(next)
      if (next.valid) clearErrors()
    },
    [clearErrors],
  )

  function stageCharacter(
    character: CharacterTemplate,
    plan: CharacterCreationProgressionPlan,
  ) {
    const bonusRule = readRacialBonusRule()
    const racialBonusError = validateRacialBonusDistribution(
      bonusRule,
      abilityScoreOverride?.racialBonuses,
    )
    if (racialBonusError) {
      setBlockingError(racialBonusError)
      return
    }

    if (equipmentOverride && !equipmentOverride.valid) {
      setBlockingError(
        equipmentOverride.error ??
          "Complete todas as escolhas de equipamento da classe inicial.",
      )
      return
    }

    const invalidRaceChoice =
      (racialChoiceOverride && !racialChoiceOverride.valid
        ? racialChoiceOverride.error
        : undefined) ??
      (genericRacialOverride && !genericRacialOverride.valid
        ? genericRacialOverride.error
        : undefined)
    if (invalidRaceChoice) {
      setRacialChoiceError(invalidRaceChoice)
      setBlockingError(invalidRaceChoice)
      return
    }

    if (backgroundChoiceOverride && !backgroundChoiceOverride.valid) {
      const error =
        backgroundChoiceOverride.error ??
        "Complete todas as escolhas obrigatórias do antecedente."
      setBackgroundChoiceError(error)
      setBlockingError(error)
      return
    }

    const inventory = replaceClassStartingEquipment(
      character.get("inventory") ?? [],
      equipmentOverride?.items,
    )
    const sheet = character.get("sheet")
    const originalRaceProficiencyIds = new Set(
      (sheet.race.proficiencies ?? []).map((entry) => entry.id),
    )
    const backgroundProficiencies =
      backgroundChoiceOverride?.apply(sheet.proficiencies ?? []) ??
      sheet.proficiencies
    const specificRace = racialChoiceOverride?.apply(
      sheet.race.naturalAbilities ?? [],
      sheet.race.proficiencies ?? [],
    )
    const genericRace = genericRacialOverride?.apply(
      specificRace?.proficiencies ?? sheet.race.proficiencies,
    )
    const raceProficiencies =
      genericRace?.proficiencies ??
      specificRace?.proficiencies ??
      sheet.race.proficiencies
    const proficiencies = [
      ...(backgroundProficiencies ?? []).filter(
        (entry) => !originalRaceProficiencyIds.has(entry.id),
      ),
      ...raceProficiencies,
    ]
    const skills = { ...sheet.skills }
    for (const skill of [
      ...(specificRace?.skills ?? []),
      ...(genericRace?.skills ?? []),
    ]) {
      skills[skill] = "proficient"
    }

    const patched = character.withPatch({
      inventory,
      sheet: {
        ...sheet,
        attributes: abilityScoreOverride?.attributes ?? sheet.attributes,
        skills,
        proficiencies,
        race: {
          ...sheet.race,
          naturalAbilities:
            specificRace?.abilities ?? sheet.race.naturalAbilities,
          proficiencies: raceProficiencies,
          attributeBonus:
            abilityScoreOverride?.racialBonuses ?? sheet.race.attributeBonus,
          attributeBonusRule: bonusRule,
        },
      },
    })
    clearErrors()
    setPendingCreation({
      character: refreshProgressionFeatureMechanics(
        materializeProgressionChoices(
          finalizeProgressionFeatures(patched),
        ),
      ),
      plan,
    })
  }

  function finishIdentity(identity: FinalCharacterIdentity) {
    if (!pendingCreation) return
    const profile = pendingCreation.character.get("profile")
    const backgroundTitle = extractBackgroundTitle(profile.history)
    const history = [
      backgroundTitle,
      identity.backgroundDescription,
    ]
      .filter(Boolean)
      .join("\n")

    const character = pendingCreation.character.withPatch({
      name: identity.name,
      profile: {
        ...profile,
        alignment: identity.alignment,
        history,
        physicalAppearance: identity.physicalAppearance,
        traits: identity.personalityTraits,
        relationships: identity.relationships,
      },
    })
    const plan = pendingCreation.plan
    setPendingCreation(null)
    props.onCreate(character, plan)
  }

  return (
    <>
      <IntegratedCharacterCreationWizard
        {...props}
        onCreate={stageCharacter}
      />

      <InitialIdentityStepSkipper open={props.open && !pendingCreation} />
      <CharacterCreationEquipmentChoicesStable
        onChange={handleEquipmentChange}
      />
      <CharacterCreationAbilityScoreRules onChange={handleAbilityScoreChange} />
      <CharacterCreationRacialChoices
        onChange={handleRacialChoiceChange}
        externalError={racialChoiceError}
      />
      <CharacterCreationGenericRacialChoices
        onChange={handleGenericRacialChange}
        externalError={racialChoiceError}
      />
      <CharacterCreationBackgroundChoices
        onChange={handleBackgroundChoiceChange}
        externalError={backgroundChoiceError}
      />
      <CreationRequiredFieldHighlighter />
      <CreationSpellGrantLocalizationBridge />
      <ProgressionFeatureModalEnhancer />
      <ProgressionModalInstantSelectionBridge />
      <ProgressionSpellSelectionModal />

      <FinalCharacterIdentityDialog
        open={pendingCreation !== null}
        initialBackgroundDescription={
          pendingCreation
            ? extractBackgroundDescription(
                pendingCreation.character.get("profile").history,
              )
            : ""
        }
        onCancel={() => setPendingCreation(null)}
        onConfirm={finishIdentity}
      />

      {blockingError ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[260] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger shadow-theme-lg">
          {blockingError}
        </div>
      ) : null}
    </>
  )
}

function InitialIdentityStepSkipper({ open }: { open: boolean }) {
  useEffect(() => {
    if (!open) return

    const apply = () => {
      const creatorTitle = Array.from(document.querySelectorAll("h1")).find(
        (entry) => entry.textContent?.trim() === "Criar personagem",
      )
      const root = creatorTitle?.closest<HTMLElement>("div.grid")
      if (!root) return

      const stepButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("header button"))
        .filter((button) => /^\d+\./.test(button.textContent?.trim() ?? ""))
      if (stepButtons.length < 2) return

      const identityButton = stepButtons[0]
      identityButton.hidden = true
      stepButtons.slice(1).forEach((button, index) => {
        const original = button.dataset.originalCreationStepLabel || button.textContent?.trim() || ""
        button.dataset.originalCreationStepLabel = original
        const label = original.replace(/^\d+\.\s*/, "")
        button.textContent = `${index + 1}. ${label === "Confirmação" ? "Confirmação e identidade" : label}`
      })

      const identityHeading = Array.from(root.querySelectorAll<HTMLElement>("main h2")).find(
        (heading) => heading.textContent?.trim() === "Identidade",
      )
      if (!identityHeading) return

      const nameInput = root.querySelector<HTMLInputElement>("main input[placeholder='Nome do personagem']")
      if (nameInput && !nameInput.value) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set
        valueSetter?.call(nameInput, "Personagem em criação")
        nameInput.dispatchEvent(new Event("input", { bubbles: true }))
      }
      stepButtons[1]?.click()
    }

    apply()
    const interval = window.setInterval(apply, 400)
    return () => window.clearInterval(interval)
  }, [open])

  return null
}

function replaceClassStartingEquipment(
  inventory: Itemmable[],
  replacement: Itemmable[] | undefined,
): Itemmable[] {
  if (!replacement) return inventory
  const retained = inventory.filter((item) => {
    const notes = item.notes?.toLocaleLowerCase("pt-BR") ?? ""
    return !(
      notes.includes("equipamento inicial da classe") ||
      notes.includes("classe inicial:") ||
      notes.includes("moeda inicial da criação") ||
      notes.includes("ouro inicial de")
    )
  })
  return [...retained, ...replacement]
}

function readRacialBonusRule(): RacialAttributeBonusRule {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button"),
  )
  const selected = buttons.find(
    (button) =>
      button.classList.contains("bg-accentBg") &&
      [
        "Predefinidos",
        "+1 / +1",
        "Móveis +2 / +1",
        "Móveis +1 / +1 / +1",
        "Personalizados",
      ].includes(button.textContent?.trim() ?? ""),
  )
  const label = selected?.textContent?.trim()
  if (label === "+1 / +1") return "variant-1-1"
  if (label === "Móveis +2 / +1") return "flexible-2-1"
  if (label === "Móveis +1 / +1 / +1") return "flexible-1-1-1"
  if (label === "Personalizados") return "custom"
  return "fixed"
}

function validateRacialBonusDistribution(
  rule: RacialAttributeBonusRule,
  bonuses: Partial<Record<string, number>> | undefined,
): string {
  if (!bonuses) return "Defina os bônus raciais antes de confirmar."
  const values = Object.values(bonuses)
    .map((value) => Math.max(0, Math.trunc(Number(value) || 0)))
    .filter((value) => value > 0)
    .toSorted((left, right) => right - left)
  const signature = values.join(",")

  if (rule === "variant-1-1" && signature !== "1,1") {
    return "A regra +1/+1 exige dois atributos distintos, cada um recebendo +1."
  }
  if (rule === "flexible-2-1" && signature !== "2,1") {
    return "A regra móvel +2/+1 exige dois atributos distintos."
  }
  if (rule === "flexible-1-1-1" && signature !== "1,1,1") {
    return "A regra móvel +1/+1/+1 exige três atributos distintos."
  }
  return ""
}

function extractBackgroundTitle(history: string): string {
  return history
    .split("\n")
    .find((line) => line.trim().toLocaleLowerCase("pt-BR").startsWith("antecedente:"))
    ?.trim() ?? ""
}

function extractBackgroundDescription(history: string): string {
  return history
    .split("\n")
    .filter(
      (line) =>
        !line.trim().toLocaleLowerCase("pt-BR").startsWith("antecedente:"),
    )
    .join("\n")
    .trim()
}
