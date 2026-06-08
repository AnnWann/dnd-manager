import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import { attributeShort } from "../../../../lib/attributeShorts"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { ATTRIBUTE_KEYS, type Attribute } from "../../../../models/sheet/Attribute"
import type { CharacterClassInterface, ClassLevel, ClassName } from "../../../../models/sheet/Class"


const CLASS_PT: Record<ClassName, string > = {
  "artificer": "Artífice",
  "barbarian": "Bárbaro",
  "bard": "Bardo",
  "cleric": "Clérigo",
  "druid": "Druida",
  "fighter": "Guerreiro",
  "monk": "Monge",
  "paladin": "Paladino",
  "ranger": "Patrulheiro",
  "rogue": "Ladino",
  "sorcerer": "Feiticeiro",
  "warlock": "Bruxo",
  "wizard": "Mago",
}

type Props = {
  character: CharacterTemplate
  classData: CharacterClassInterface
  classIndex: number
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

function clampLevel(value: number): ClassLevel {
  return Math.max(1, Math.min(20, value)) as ClassLevel
}

export function SelectClassModule({
  character,
  classData,
  classIndex,
  updateCharacter
}: Props) {
  const canEditCasting =
    classData.className === "fighter" || classData.className === "rogue"

  function updateCharacterClasses(
    updater: (classes: CharacterClassInterface[]) => CharacterClassInterface[],
    ) {
      updateCharacter(character.get("id"), (c) => {
        const sheet = c.get("sheet")
        const nextClasses = updater(sheet.classes ?? [])

        return c
          .withSheet("classes", nextClasses)
          .ensureMagic()
          .syncMagicWithClasses()
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
      classes.filter((_, i) => i !== classIndex),
    )
  }

  return (
    <div className="grid grid-cols-1 gap-2 rounded-md border border-border p-2 md:grid-cols-[1fr_100px_220px_220px_44px]">
      <div className="min-w-0">
        <div className="text-xs text-text">Classe</div>
        <div className="truncate text-sm text-textH">
          {CLASS_PT[classData.className]}
        </div>
      </div>

      <div>
        <div className="text-xs text-text">Nível</div>
        <Input
          type="number"
          className="mt-1 h-9 px-2"
          min={1}
          max={20}
          value={classData.level}
          onChange={(e) =>
            updateClass({
              ...classData,
              level: clampLevel(Number(e.target.value)),
            })
          }
        />
      </div>

      <div>
        <div className="text-xs text-text">Progressão mágica</div>

        <Select
          className="mt-1 h-9 px-2 py-1"
          value={classData.spellcastingProgression ?? "none"}
          onChange={(e) => {
            const value = e.target.value

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
      </div>

      <div>
        <div className="text-xs text-text">Atributo de conjuração</div>

        <Select
          className="mt-1 h-9 px-2 py-1"
          value={classData.castingAttribute ?? ""}
          disabled={!classData.spellcastingProgression && !canEditCasting}
          onChange={(e) =>
            updateClass({
              ...classData,
              castingAttribute: e.target.value as Attribute,
            })
          }
        >
          <option value="">Nenhum</option>
          {ATTRIBUTE_KEYS.map((a) => (
            <option key={a} value={a}>
              {attributeShort(a)}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-end">
        <Button
          className="w-full"
          size="sm"
          variant="secondary"
          onClick={removeClass}
          title="Remover classe"
        >
          ✕
        </Button>
      </div>
    </div>
  )
}

