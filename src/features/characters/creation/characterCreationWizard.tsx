import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"

import { useMagicContext } from "../../../contexts/magicContext"
import {
  createEmptyCharacterCreationIdentity,
  type CharacterCreationIdentity,
  type CharacterCreationProgressionPlan,
} from "../../../models/characters/creation/CharacterCreation"
import {
  DEFAULT_CUSTOM_CLASS_CONFIG,
  getCustomClassConfigFromEntry,
  hasCustomClass,
  isCustomClassEntry,
  normalizeCustomClassConfig,
  type CustomClassRuntimeConfig,
} from "../../../models/characters/customClassConfig"
import { applyCustomClassCreationConfiguration } from "../../../models/characters/customClassProgression"
import type { ClassName } from "../../../models/sheet/Class"
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
import { CreationLegacyProgressionStateSync } from "./bridges/CreationLegacyProgressionStateSync"
import {
  CreationManualSubclassEditor,
  type ManualSubclassSelection,
} from "./bridges/CreationManualSubclassEditor"
import { CreationProgressionConfigurationBridge } from "./bridges/CreationProgressionConfigurationBridge"
import { CreationRequiredFieldHighlighter } from "./bridges/CreationRequiredFieldHighlighter"
import {
  clearCharacterCreationDraft,
  getCharacterCreationDraftId,
  readCharacterCreationDraftSection,
  writeCharacterCreationDraftSection,
} from "./characterCreationDraftCache"
import {
  applyCreationProgressionConfiguration,
  createEmptyCreationProgressionConfiguration,
  type CreationProgressionConfiguration,
} from "./creationProgressionConfiguration"
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

type WizardProps = Omit<
  ComponentProps<typeof IntegratedCharacterCreationWizard>,
  | "draftId"
  | "customClassName"
  | "customClassConfigs"
  | "onApplyCustomClassConfig"
  | "onRemoveCustomClassConfig"
>

type WrapperDraft = {
  identity: CharacterCreationIdentity
  progressionConfiguration: CreationProgressionConfiguration
  subclasses: Partial<Record<ClassName, ManualSubclassSelection>>
  customClassConfig?: CustomClassRuntimeConfig
  customClassConfigs?: Record<string, CustomClassRuntimeConfig>
}

function createCustomClassDraft(): CustomClassRuntimeConfig {
  return normalizeCustomClassConfig({
    ...DEFAULT_CUSTOM_CLASS_CONFIG,
    savingThrows: [...DEFAULT_CUSTOM_CLASS_CONFIG.savingThrows],
    spellSlotProgression: { ...DEFAULT_CUSTOM_CLASS_CONFIG.spellSlotProgression },
    additionalSlotPools: [...DEFAULT_CUSTOM_CLASS_CONFIG.additionalSlotPools],
  })
}

export function CharacterCreationWizard(props: WizardProps) {
  const { spells } = useMagicContext()
  const draftId = getCharacterCreationDraftId(
    props.defaultOwner.id || props.defaultOwner.name,
  )
  const [equipment, setEquipment] = useState<EquipmentOverride | null>(null)
  const [abilityScores, setAbilityScores] =
    useState<AbilityScoreOverride | null>(null)
  const [racialChoices, setRacialChoices] =
    useState<RacialChoiceOverride | null>(null)
  const [genericRacialChoices, setGenericRacialChoices] =
    useState<GenericRacialChoiceOverride | null>(null)
  const [backgroundChoices, setBackgroundChoices] =
    useState<BackgroundChoiceOverride | null>(null)
  const [progressionConfiguration, setProgressionConfiguration] =
    useState<CreationProgressionConfiguration>(() =>
      createEmptyCreationProgressionConfiguration(),
    )
  const [subclasses, setSubclasses] = useState<
    Partial<Record<ClassName, ManualSubclassSelection>>
  >({})
  const [customClassConfigs, setCustomClassConfigs] = useState<
    Record<string, CustomClassRuntimeConfig>
  >({})
  const [identity, setIdentity] = useState<CharacterCreationIdentity>(() =>
    createEmptyCharacterCreationIdentity(),
  )
  const identityRef = useRef(identity)
  const [draftHydrated, setDraftHydrated] = useState(false)

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
      setProgressionConfiguration(
        createEmptyCreationProgressionConfiguration(),
      )
      setSubclasses({})
      setCustomClassConfigs({})
      setDraftHydrated(false)
      clearErrors()
      return
    }

    const cached = readCharacterCreationDraftSection<WrapperDraft>(
      draftId,
      "wrapper",
    )
    if (cached) {
      const nextIdentity =
        cached.identity ?? createEmptyCharacterCreationIdentity()
      identityRef.current = nextIdentity
      setIdentity(nextIdentity)
      setProgressionConfiguration(
        cached.progressionConfiguration ??
          createEmptyCreationProgressionConfiguration(),
      )
      setSubclasses(cached.subclasses ?? {})
      if (cached.customClassConfigs) {
        setCustomClassConfigs(
          Object.fromEntries(
            Object.entries(cached.customClassConfigs).map(([className, config]) => [
              className,
              normalizeCustomClassConfig(config),
            ]),
          ),
        )
      } else if (cached.customClassConfig) {
        setCustomClassConfigs({
          __custom__: normalizeCustomClassConfig(cached.customClassConfig),
        })
      }
    }
    setDraftHydrated(true)

    const clearAfterEdit = (event: Event) => {
      if (event.target instanceof Element) clearErrors()
    }

    // Let React-controlled fields process their edit before clearing
    // wrapper validation errors. Capture-phase listeners can rerender
    // the wizard before React receives the new input/select value.
    document.addEventListener("input", clearAfterEdit)
    document.addEventListener("change", clearAfterEdit)
    return () => {
      document.removeEventListener("input", clearAfterEdit)
      document.removeEventListener("change", clearAfterEdit)
    }
  }, [clearErrors, draftId, props.open])

  useEffect(() => {
    if (!props.open || !draftHydrated) return
    writeCharacterCreationDraftSection(draftId, "wrapper", {
      identity,
      progressionConfiguration,
      subclasses,
      customClassConfigs,
    } satisfies WrapperDraft)
  }, [
    customClassConfigs,
    draftHydrated,
    draftId,
    identity,
    progressionConfiguration,
    props.open,
    subclasses,
  ])

  const updateIdentity = useCallback((next: CharacterCreationIdentity) => {
    identityRef.current = next
    setIdentity(next)
    setIdentityError("")
    setBlockingError("")
  }, [])

  const updateProgressionConfiguration = useCallback(
    (next: CreationProgressionConfiguration) => {
      setProgressionConfiguration(next)
      clearErrors()
    },
    [clearErrors],
  )

  const handleCreate: WizardProps["onCreate"] = async (character, plan) => {
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
    let configured = applyCreationProgressionConfiguration(
      withManualClasses,
      progressionConfiguration,
      spells,
    )
    if (hasCustomClass(configured)) {
      for (const classEntry of configured.get("sheet").classes ?? []) {
        if (!isCustomClassEntry(classEntry)) continue
        const config =
          customClassConfigs[String(classEntry.className)] ??
          getCustomClassConfigFromEntry(classEntry)
        if (!config) continue
        configured = applyCustomClassCreationConfiguration(
          configured,
          config,
          [],
          classEntry.className,
        )
      }
    }
    await props.onCreate(configured, plan)
    clearCharacterCreationDraft(draftId)
  }

  return (
    <>
      <IntegratedCharacterCreationWizard
        {...props}
        draftId={draftId}
        customClassName="Classe personalizada"
        customClassConfigs={customClassConfigs}
        onApplyCustomClassConfig={(className, next) =>
          setCustomClassConfigs((current) => ({
            ...current,
            [String(className)]: normalizeCustomClassConfig(next),
          }))
        }
        onRemoveCustomClassConfig={(className) =>
          setCustomClassConfigs((current) => {
            const next = { ...current }
            delete next[String(className)]
            return next
          })
        }
        onCreate={handleCreate}
      />

      <CharacterCreationFlowBootstrap open={props.open} />
      <CharacterCreationIdentityStep
        open={props.open}
        value={identity}
        onChange={updateIdentity}
        externalError={identityError}
      />
      <CharacterCreationEquipmentChoices
        draftId={draftId}
        onChange={(next) => {
          if (!next) return
          setEquipment(next)
          if (next.valid) setBlockingError("")
        }}
      />
      <CharacterCreationAbilityScoreRules
        draftId={draftId}
        onChange={(next) => {
          if (!next) return
          setAbilityScores(next)
          setBlockingError("")
        }}
      />
      <CharacterCreationRacialChoices
        draftId={draftId}
        onChange={(next) => {
          if (!next) return
          setRacialChoices(next)
          if (next.valid) clearErrors()
        }}
        externalError={raceError}
      />
      <CharacterCreationGenericRacialChoices
        draftId={draftId}
        onChange={(next) => {
          if (!next) return
          setGenericRacialChoices(next)
          if (next.valid) clearErrors()
        }}
        externalError={raceError}
      />
      <CharacterCreationBackgroundChoices
        draftId={draftId}
        onChange={(next) => {
          if (!next) return
          setBackgroundChoices(next)
          if (next.valid) clearErrors()
        }}
        externalError={backgroundError}
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
      <CreationProgressionConfigurationBridge
        open={props.open}
        value={progressionConfiguration}
        onChange={updateProgressionConfiguration}
      />
      <CreationLegacyProgressionStateSync
        open={props.open}
        value={progressionConfiguration}
      />

      <CreationRequiredFieldHighlighter
        resetSignal={progressionConfiguration}
      />


      {blockingError ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[260] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger shadow-theme-lg">
          {blockingError}
        </div>
      ) : null}
    </>
  )
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
