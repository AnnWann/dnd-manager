import { Input } from "../../../../../../components/ui/Input"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { Sheet } from "../../../../../../models/sheet/Sheet"

type StatKey = keyof Sheet["stats"]

type Props = {
  name: string
  statKey: StatKey
  getValue: (character: CharacterTemplate) => number
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  fallback?: number
  readOnly?: boolean
}

export function SelectStatModule({
  name,
  statKey,
  getValue,
  character,
  updateCharacter,
  fallback = 0,
  readOnly = false,
}: Props) {
  const value = getValue(character)

  return (
    <div>
      <label className="text-xs text-text">{name}</label>

      <Input
        type="number"
        className="mt-1"
        value={Number.isFinite(value) ? value : fallback}
        readOnly={readOnly}
        onChange={(e) => {
          const nextValue = Number(e.target.value) || fallback

          updateCharacter(character.get("id"), (c) =>
            c.withStat(statKey, nextValue),
          )
        }}
      />
    </div>
  )
}