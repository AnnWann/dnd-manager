import { useMemo, useState, type ComponentProps } from "react"

import { useMagicContext } from "../../../contexts/magicContext"
import { finalizeDynamicSubclassSpells } from "../../../lib/characterProgression/finalizeDynamicSubclassSpells"
import {
  createProgressionCalculationCharacter,
  restoreStoredProgressionAttributes,
} from "../../../lib/characterProgression/progressionCharacterSnapshot"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  applyClassProficiencies,
  validateClassProficiencySelections,
  type ClassProficiencySelection,
} from "../../../models/leveling/ClassProficiencyRules"
import { finalizeProgressionFeatures } from "../../../models/leveling/ProgressionFeatureFinalization"
import { refreshProgressionFeatureMechanics } from "../../../models/leveling/refreshProgressionFeatureMechanics"
import type { ClassName } from "../../../models/sheet/Class"
import type { Skill } from "../../../models/sheet/Skills"
import { ProgressionFeatureDescriptionSync } from "./bridges/ProgressionFeatureDescriptionSync"
import { ProgressionModalSelectionSync } from "./bridges/ProgressionModalSelectionSync"
import { CharacterProgressionConfigurator } from "./CharacterProgressionConfigurator"
import { MulticlassProficiencyStep } from "./components/MulticlassProficiencyStep"
import { ProgressionFeatureModalEnhancer } from "./ProgressionFeatureModalEnhancer"
import { ProgressionSpellSelectionModal } from "./ProgressionSpellSelectionModal"

type Props = ComponentProps<typeof CharacterProgressionConfigurator>

type PendingMulticlass = {
  character: CharacterTemplate
  newClasses: ClassName[]
}

export function CharacterProgressionFlow({
  onComplete,
  ...props
}: Props) {
  const { spells } = useMagicContext()
  const [pending, setPending] = useState<PendingMulticlass | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<
    Partial<Record<ClassName, Skill[]>>
  >({})
  const [selectedTools, setSelectedTools] = useState<
    Partial<Record<ClassName, string>>
  >({})
  const [validationMessage, setValidationMessage] = useState("")

  const calculationCharacter = useMemo(
    () => createProgressionCalculationCharacter(props.character),
    [props.character],
  )
  const originalClassNames = useMemo(
    () =>
      new Set(
        (props.character.get("sheet").classes ?? []).map(
          (entry) => entry.className,
        ),
      ),
    [props.character],
  )

  function finish(character: CharacterTemplate) {
    const finalizedFeatures = refreshProgressionFeatureMechanics(
      finalizeProgressionFeatures(character),
    )
    onComplete(
      finalizeDynamicSubclassSpells(
        finalizedFeatures,
        spells,
        props.mode,
      ),
    )
  }

  function receiveProgression(calculatedCharacter: CharacterTemplate) {
    const character = restoreStoredProgressionAttributes(
      calculatedCharacter,
      props.character,
    )
    const newClasses = (character.get("sheet").classes ?? [])
      .map((entry) => entry.className)
      .filter((className) => !originalClassNames.has(className))

    if (!newClasses.length) {
      finish(character)
      return
    }

    setSelectedSkills({})
    setSelectedTools({})
    setValidationMessage("")
    setPending({ character, newClasses })
  }

  function toggleSkill(className: ClassName, skill: Skill) {
    setSelectedSkills((current) => {
      const entries = current[className] ?? []
      return {
        ...current,
        [className]: entries.includes(skill)
          ? entries.filter((entry) => entry !== skill)
          : [...entries, skill],
      }
    })
    setValidationMessage("")
  }

  function confirmMulticlassProficiencies() {
    if (!pending) return
    const selections: ClassProficiencySelection[] = pending.newClasses.map(
      (className) => ({
        className,
        previousLevel: 0,
        selectedSkills: selectedSkills[className] ?? [],
        selectedToolOrInstrument: selectedTools[className],
      }),
    )
    const error = validateClassProficiencySelections(selections)
    if (error) {
      setValidationMessage(error)
      return
    }

    finish(applyClassProficiencies(pending.character, selections))
  }

  if (pending) {
    return (
      <MulticlassProficiencyStep
        character={pending.character}
        classNames={pending.newClasses}
        selectedSkills={selectedSkills}
        selectedTools={selectedTools}
        validationMessage={validationMessage}
        onToggleSkill={toggleSkill}
        onToolChange={(className, value) => {
          setSelectedTools((current) => ({
            ...current,
            [className]: value,
          }))
          setValidationMessage("")
        }}
        onBack={() => {
          setPending(null)
          setValidationMessage("")
        }}
        onConfirm={confirmMulticlassProficiencies}
      />
    )
  }

  return (
    <>
      <CharacterProgressionConfigurator
        {...props}
        character={calculationCharacter}
        onComplete={receiveProgression}
      />
      <ProgressionFeatureDescriptionSync />
      <ProgressionModalSelectionSync />
      <ProgressionFeatureModalEnhancer />
      <ProgressionSpellSelectionModal />
    </>
  )
}

export { finalizeDynamicSubclassSpells }
