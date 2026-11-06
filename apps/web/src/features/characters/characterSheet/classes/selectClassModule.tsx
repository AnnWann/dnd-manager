import { useState } from "react"
import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import { attributeShort } from "../../../../lib/attributeShorts"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import {
  CUSTOM_CLASS_CHOICE_KEY,
  isCustomClassEntry,
} from "../../../../models/characters/customClassConfig"
import {
  getDerivedSorceryPointMaximum,
  getSorceryPointPool,
  setSorceryPointCurrent,
} from "../../../../models/characters/characterSorceryPoints"
import {
  ATTRIBUTE_KEYS,
  type Attribute,
} from "../../../../models/sheet/Attribute"
import type {
  CharacterClassInterface,
  ClassLevel,
  ClassName,
} from "../../../../models/sheet/Class"

const CLASS_PT: Partial<Record<ClassName, string>> = {
  artificer: "Artífice",
  barbarian: "Bárbaro",
  bard: "Bardo",
  cleric: "Clérigo",
  druid: "Druida",
  fighter: "Guerreiro",
  monk: "Monge",
  paladin: "Paladino",
  ranger: "Patrulheiro",
  rogue: "Ladino",
  sorcerer: "Feiticeiro",
  warlock: "Bruxo",
  wizard: "Mago",
}

type Props = {
  character: CharacterTemplate
  classData: CharacterClassInterface
  classIndex: number
  maxLevel: number
  disabled: boolean
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

function clampLevel(value: number, maxLevel: number): ClassLevel {
  const safeMaxLevel = Math.max(1, Math.min(20, Math.trunc(maxLevel) || 1))
  return Math.max(1, Math.min(safeMaxLevel, value)) as ClassLevel
}

function getClassLabel(classData: CharacterClassInterface): string {
  if (isCustomClassEntry(classData)) {
    return (
      classData.levelChoices?.[CUSTOM_CLASS_CHOICE_KEY]?.[0] ||
      "Classe personalizada"
    )
  }
  return CLASS_PT[classData.className] ?? String(classData.className)
}

export function SelectClassModule({
  character,
  classData,
  classIndex,
  maxLevel,
  disabled,
  updateCharacter,
}: Props) {
  const [levelDraft, setLevelDraft] = useState<string>()
  const customClass = isCustomClassEntry(classData)
  const canEditCasting =
    !customClass &&
    (classData.className === "fighter" || classData.className === "rogue")

  function updateCharacterClasses(
    updater: (
      classes: CharacterClassInterface[],
    ) => CharacterClassInterface[],
  ) {
    updateCharacter(character.get("id"), (current) => {
      const previousPool = getSorceryPointPool(current)
      const sheet = current.get("sheet")
      const nextClasses = updater(sheet.classes ?? [])
      const withClasses = current.withSheet("classes", nextClasses)
      const nextMaximum = getDerivedSorceryPointMaximum(withClasses)
      const spentPoints = Math.max(
        0,
        previousPool.max - previousPool.current,
      )
      const nextCurrent = Math.max(0, nextMaximum - spentPoints)
      const syncedMagic = withClasses
        .ensureMagic()
        .syncMagicWithClasses()

      return setSorceryPointCurrent(syncedMagic, nextCurrent)
    })
  }

  function updateClass(nextClass: CharacterClassInterface) {
    updateCharacterClasses((classes) => {
      const nextClasses = [...classes]
      nextClasses[classIndex] = nextClass
      return nextClasses
    })
  }

  function removeClass() {
    updateCharacterClasses((classes) =>
      classes.filter((_, index) => index !== classIndex),
    )
  }

  const safeMaxLevel = Math.max(1, Math.min(20, Math.trunc(maxLevel) || 1))

  function commitLevel() {
    setLevelDraft(undefined)
    if (disabled || !levelDraft?.trim()) return
    const value = Number(levelDraft)
    if (!Number.isInteger(value)) return
    const level = clampLevel(value, safeMaxLevel)
    if (level !== classData.level) updateClass({ ...classData, level })
  }

  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 md:grid-cols-[1fr_100px_220px_220px_44px]">
      <div className="min-w-0">
        <div className="text-xs text-text">Classe</div>
        <div className="truncate text-sm text-textH">
          {getClassLabel(classData)}
        </div>
        {customClass ? (
          <div className="mt-1 text-[10px] font-medium text-accent">
            Classe personalizada
          </div>
        ) : null}
      </div>

      <div>
        <div className="text-xs text-text">Nível</div>
        <Input
          type="number"
          className="mt-1 h-9 px-2"
          min={1}
          max={safeMaxLevel}
          value={levelDraft ?? classData.level}
          aria-label={`Nível de ${getClassLabel(classData)}`}
          disabled={disabled}
          title={`Máximo para esta classe: ${safeMaxLevel}`}
          onChange={event => setLevelDraft(event.target.value)}
          onBlur={commitLevel}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
        />
      </div>

      <div>
        <div className="text-xs text-text">Progressão mágica</div>

        {customClass ? (
          <div className="mt-1 flex h-9 items-center rounded-md border border-border bg-bg-subtle px-2 text-xs text-textMuted">
            Configurar na aba Magias
          </div>
        ) : (
          <Select
            className="mt-1 h-9 px-2 py-1"
            disabled={disabled}
            value={classData.spellcastingProgression ?? "none"}
            onChange={(event) => {
              const value = event.target.value

              updateClass({
                ...classData,
                spellcastingProgression:
                  value === "none"
                    ? undefined
                    : (value as "full" | "half" | "third"),
              })
            }}
          >
            <option value="none">Nenhuma</option>
            <option value="full">Completa</option>
            <option value="half">Meia</option>
            <option value="third">Terço</option>
          </Select>
        )}
      </div>

      <div>
        <div className="text-xs text-text">Atributo de conjuração</div>

        {customClass ? (
          <div className="mt-1 flex h-9 items-center rounded-md border border-border bg-bg-subtle px-2 text-xs text-textMuted">
            Configurar na aba Magias
          </div>
        ) : (
          <Select
            className="mt-1 h-9 px-2 py-1"
            value={classData.castingAttribute ?? ""}
            disabled={disabled || (!classData.spellcastingProgression && !canEditCasting)}
            onChange={(event) =>
              updateClass({
                ...classData,
                castingAttribute: event.target.value as Attribute,
              })
            }
          >
            <option value="">Nenhum</option>
            {ATTRIBUTE_KEYS.map((attribute) => (
              <option key={attribute} value={attribute}>
                {attributeShort(attribute)}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div className="flex items-end">
        <Button
          className="w-full"
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={removeClass}
          title="Remover classe"
        >
          ✕
        </Button>
      </div>
    </div>
  )
}
