import { Input } from "../../../../../../components/ui/Input"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { Sheet } from "../../../../../../models/sheet/Sheet"


export type StatKey = keyof Sheet['stats']

type Props = {
  name: string
  statKey: StatKey
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
  fallback?: number
  readOnly?: boolean
}

export function SelectStatModule ({
  name,
  statKey,
  character,
  updateCharacter,
  fallback = 0,
  readOnly = false,
}: Props) {
  const value = character.get('sheet').stats[statKey]

  return (
    <div>
      <label className="text-xs text-text">{name}</label>

      <Input
        type="number"
        className="mt-1"
        value={typeof value === 'number' ? value : fallback}
        readOnly={readOnly}
        onChange={(e) => {
          const nextValue = Number(e.target.value) || fallback

          updateCharacter(character.get('id'), (c) => c.withStat(statKey, nextValue))
        }}
      />
    </div>
  )
}