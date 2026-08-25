import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react"

import { Button } from "../../../components/ui/Button"
import { useMagicContext } from "../../../contexts/magicContext"
import {
  createEmptyCharacterCreationIdentity,
  type CharacterCreationIdentity,
  type CharacterCreationProgressionPlan,
} from "../../../models/characters/creation/CharacterCreation"
import {
  DEFAULT_CUSTOM_CLASS_CONFIG,
  CUSTOM_CLASS_RUNTIME_ID,
  hasCustomClass,
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
import { CustomClassConfigurationEditor } from "../characterSheet/classes/CustomClassConfigurationTab"
import {
  CharacterCreationAbilityScoreRules,
  type AbilityScoreOverride,
} from "./CharacterCreationAbilityScoreRules"
import {
  CharacterCreationBackgroundChoices,
  type BackgroundChoiceOverride,
} from "./CharacterCreationBackgroundChoices"
import { CharacterCreationCustomClassSelectionBridge } from "./bridges/CreationCustomClassSelectionBridge"
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
  "draftId"
>

type WrapperDraft = {
  identity: CharacterCreationIdentity
  progressionConfiguration: CreationProgressionConfiguration
  subclasses: Partial<Record<ClassName, ManualSubclassSelection>>
  customClassConfig?: CustomClassRuntimeConfig
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
  const [customClassConfig, setCustomClassConfig] =
    useState<CustomClassRuntimeConfig>(createCustomClassDraft)
  const [customClassDialogOpen, setCustomClassDialogOpen] = useState(false)
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
      setCustomClassConfig(createCustomClassDraft())
      setCustomClassDialogOpen(false)
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
      if (cached.customClassConfig) {
        setCustomClassConfig(
          normalizeCustomClassConfig(cached.customClassConfig),
        )
      }
    }
    setDraftHydrated(true)

    const clearAfterEdit = (event: Event) => {
      if (event.target instanceof Element) clearErrors()
    }

    document.addEventListener("input", clearAfterEdit, true)
    document.addEventListener("change", clearAfterEdit, true)
    return () => {
      document.removeEventListener("input", clearAfterEdit, true)
      document.removeEventListener("change", clearAfterEdit, true)
    }
  }, [clearErrors, draftId, props.open])

  useEffect(() => {
    if (!props.open || !draftHydrated) return
    writeCharacterCreationDraftSection(draftId, "wrapper", {
      identity,
      progressionConfiguration,
      subclasses,
      customClassConfig,
    } satisfies WrapperDraft)
  }, [
    customClassConfig,
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
      configured = applyCustomClassCreationConfiguration(
        configured,
        customClassConfig,
      )
    }
    await props.onCreate(configured, plan)
    clearCharacterCreationDraft(draftId)
  }

  return (
    <>
      <div
        onChangeCapture={(event) => {
          const target = event.target
          if (
            target instanceof HTMLSelectElement &&
            target.value === String(CUSTOM_CLASS_RUNTIME_ID)
          ) {
            setCustomClassDialogOpen(true)
          }
        }}
      >
        <IntegratedCharacterCreationWizard
          {...props}
          draftId={draftId}
          onCreate={handleCreate}
        />
      </div>

      <CharacterCreationCustomClassSelectionBridge
        open={props.open}
        customName={customClassConfig.name}
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

      <CustomClassCreationDialog
        open={customClassDialogOpen}
        config={customClassConfig}
        onClose={() => setCustomClassDialogOpen(false)}
        onApply={(next) => {
          setCustomClassConfig(normalizeCustomClassConfig(next))
          setCustomClassDialogOpen(false)
        }}
      />

      {blockingError ? (
        <div className="pointer-events-none fixed left-1/2 top-4 z-[260] w-[min(42rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger shadow-theme-lg">
          {blockingError}
        </div>
      ) : null}
    </>
  )
}

function CustomClassCreationDialog({
  open,
  config,
  onApply,
  onClose,
}: {
  open: boolean
  config: CustomClassRuntimeConfig
  onApply: (config: CustomClassRuntimeConfig) => void
  onClose: () => void
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center overflow-y-auto bg-black/65 p-3 backdrop-blur-sm sm:p-6">
      <div className="w-full max-w-6xl rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold text-textH">
              Configurar classe personalizada
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Esta configuração faz parte do rascunho da criação. Ela só é persistida quando o personagem for confirmado.
            </p>
          </div>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
        <CustomClassConfigurationEditor
          config={config}
          applyLabel="Aplicar ao rascunho"
          onApply={onApply}
        />
      </div>
    </div>
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
