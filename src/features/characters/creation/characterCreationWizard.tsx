import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"

import {
  createEmptyCharacterCreationIdentity,
  type CharacterCreationIdentity,
  type CharacterCreationProgressionPlan,
} from "../../../models/characters/creation/CharacterCreation"
import type { ClassName } from "../../../models/sheet/Class"
import type { Proficiency } from "../../../models/sheet/Proficiency"
import {
  finalizeCreatedCharacter,
  validateCharacterCreationOverrides,
  type CharacterCreationValidationError,
} from "../../../lib/characterCreation/finalizeCharacterCreation"
import {
  CharacterCreationAbilityScoreRules,
  type AbilityScoreOverride,
} from "./CharacterCreationAbilityScoreRules"
import {
  CharacterCreationBackgroundChoices,
  type BackgroundChoiceOverride,
} from "./CharacterCreationBackgroundChoices"
import { CharacterCreationFlowBootstrap } from "./bridges/CharacterCreationFlowBootstrap"
import { CreationManualClassProficiencies } from "./bridges/CreationManualClassProficiencies"
import {
  CreationManualSubclassEditor,
  type ManualSubclassSelection,
} from "./bridges/CreationManualSubclassEditor"
import { CreationRequiredFieldHighlighter } from "./bridges/CreationRequiredFieldHighlighter"
import {
  CharacterCreationEquipmentChoices,
  type EquipmentOverride,
} from "./components/CharacterCreationEquipmentChoices"
import { CharacterCreationIdentityStep } from "./components/CharacterCreationIdentityStep"
import {
  CharacterCreationGenericRacialChoices,
  type GenericRacialChoiceOverride,
} from "./CharacterCreationGenericRacialChoices"
import {
  CharacterCreationRacialChoices,
  type RacialChoiceOverride,
} from "./CharacterCreationRacialChoices"
import { IntegratedCharacterCreationWizard } from "./IntegratedCharacterCreationWizard"
import { readSelectedRacialBonusRule } from "./logic/readSelectedRacialBonusRule"

export type { CharacterCreationProgressionPlan }

type WizardProps = ComponentProps<typeof IntegratedCharacterCreationWizard>

export function CharacterCreationWizard(props: WizardProps) {
  const [equipment, setEquipment] = useState<EquipmentOverride | null>(null)
  const [abilityScores, setAbilityScores] =
    useState<AbilityScoreOverride | null>(null)
  const [racialChoices, setRacialChoices] =
    useState<RacialChoiceOverride | null>(null)
  const [genericRacialChoices, setGenericRacialChoices] =
    useState<GenericRacialChoiceOverride | null>(null)
  const [backgroundChoices, setBackgroundChoices] =
    useState<BackgroundChoiceOverride | null>(null)
  const [classProficiencies, setClassProficiencies] = useState<Proficiency[]>([])
  const [subclasses, setSubclasses] = useState<
    Partial<Record<ClassName, ManualSubclassSelection>>
  >({})
  const [identity, setIdentity] = useState<CharacterCreationIdentity>(() =>
    createEmptyCharacterCreationIdentity(),
  )
  const identityRef = useRef(identity)

  const [identityError, setIdentityError] = useState("")
  const [raceError, setRaceError] = useState("")
  const [backgroundError, setBackgroundError] = useState("")
  const [blockingError, setBlockingError] = useState("")

  const clearErrors = useCallback(() => {
    setIdentityError("")
    setRaceError("")
    setBackgroundError("")
    setBlockingError("")
  }, [])

  useEffect(() => {
    if (!props.open) {
      const emptyIdentity = createEmptyCharacterCreationIdentity()
      identityRef.current = emptyIdentity
      setIdentity(emptyIdentity)
      setEquipment(null)
      setAbilityScores(null)
      setRacialChoices(null)
      setGenericRacialChoices(null)
      setBackgroundChoices(null)
      setClassProficiencies([])
      setSubclasses({})
      clearErrors()
      return
    }

    const clearAfterEdit = (event: Event) => {
      if (event.target instanceof Element) clearErrors()
    }

    document.addEventListener("input", clearAfterEdit, true)
    document.addEventListener("change", clearAfterEdit, true)
    return () => {
      document.removeEventListener("input", clearAfterEdit, true)
      document.removeEventListener("change", clearAfterEdit, true)
    }
  }, [clearErrors, props.open])

  const updateIdentity = useCallback((next: CharacterCreationIdentity) => {
    identityRef.current = next
    setIdentity(next)
    setIdentityError("")
    setBlockingError("")
  }, [])

  const handleCreate: WizardProps["onCreate"] = (character, plan) => {
    const overrides = {
      identity: identityRef.current,
      equipment,
      abilityScores,
      racialChoices,
      genericRacialChoices,
      backgroundChoices,
      racialBonusRule: readSelectedRacialBonusRule(),
    }
    const validation = validateCharacterCreationOverrides(overrides)
    if (validation) {
      showValidationError(validation, {
        setIdentityError,
        setRaceError,
        setBackgroundError,
        setBlockingError,
      })
      return
    }

    clearErrors()
    const finalized = finalizeCreatedCharacter(character, overrides)
    const withManualClasses = finalized.withSheet(
      "classes",
      (finalized.get("sheet").classes ?? []).map((entry) => {
        const selection = subclasses[entry.className]
        const name = selection?.name.trim()
        if (!name) return entry
        return {
          ...entry,
          subclass: {
            id: entry.subclass?.id || slug(name),
            name,
            source: selection?.source.trim() || "Manual",
          },
        }
      }),
    )
    const withClassProficiencies = withManualClasses.withSheet(
      "proficiencies",
      mergeProficiencies(
        withManualClasses.get("sheet").proficiencies ?? [],
        classProficiencies,
      ),
    )
    props.onCreate(withClassProficiencies, plan)
  }

  return (
    <>
      <IntegratedCharacterCreationWizard {...props} onCreate={handleCreate} />

      <CharacterCreationFlowBootstrap open={props.open} />
      <CharacterCreationIdentityStep
        open={props.open}
        value={identity}
        onChange={updateIdentity}
        externalError={identityError}
      />
      <CharacterCreationEquipmentChoices
        onChange={(next) => {
          if (!next) return
          setEquipment(next)
          if (next.valid) setBlockingError("")
        }}
      />
      <CharacterCreationAbilityScoreRules
        onChange={(next) => {
          if (!next) return
          setAbilityScores(next)
          setBlockingError("")
        }}
      />
      <CharacterCreationRacialChoices
        onChange={(next) => {
          if (!next) return
          setRacialChoices(next)
          if (next.valid) clearErrors()
        }}
        externalError={raceError}
      />
      <CharacterCreationGenericRacialChoices
        onChange={(next) => {
          if (!next) return
          setGenericRacialChoices(next)
          if (next.valid) clearErrors()
        }}
        externalError={raceError}
      />
      <CharacterCreationBackgroundChoices
        onChange={(next) => {
          if (!next) return
          setBackgroundChoices(next)
          if (next.valid) clearErrors()
        }}
        externalError={backgroundError}
      />
      <CreationManualClassProficiencies
        open={props.open}
        proficiencies={classProficiencies}
        onChange={setClassProficiencies}
      />
      <CreationManualSubclassEditor
        open={props.open}
        selections={subclasses}
        onChange={(className, selection) =>
          setSubclasses((current) => ({
            ...current,
            [className]: selection,
          }))
        }
      />

      <CreationRequiredFieldHighlighter />

      {blockingError ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[260] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger shadow-theme-lg">
          {blockingError}
        </div>
      ) : null}
    </>
  )
}

function mergeProficiencies(
  current: Proficiency[],
  additions: Proficiency[],
): Proficiency[] {
  const merged = [...current]
  const keys = new Set(
    current.map(
      (entry) => `${entry.category}:${normalizeProficiencyName(entry.name)}`,
    ),
  )

  for (const proficiency of additions) {
    const key = `${proficiency.category}:${normalizeProficiencyName(proficiency.name)}`
    if (keys.has(key)) continue
    keys.add(key)
    merged.push(proficiency)
  }

  return merged
}

function normalizeProficiencyName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function showValidationError(
  error: CharacterCreationValidationError,
  setters: {
    setIdentityError: (message: string) => void
    setRaceError: (message: string) => void
    setBackgroundError: (message: string) => void
    setBlockingError: (message: string) => void
  },
) {
  setters.setBlockingError(error.message)

  if (error.target === "identity") {
    setters.setIdentityError(error.message)
  } else if (error.target === "race") {
    setters.setRaceError(error.message)
  } else if (error.target === "background") {
    setters.setBackgroundError(error.message)
  }
}
