import { Input } from "../../../../../../components/ui/Input"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { HP } from "../../../../../../models/sheet/HP"

export type HPKey = keyof HP

type Props = {
  name: string
  hpKey: HPKey
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function SelectHpModule ({
  name,
  hpKey,
  character,
  updateCharacter,
}: Props) {
  const value = character.get('sheet').HP[hpKey]

  return (
    <div>
      <label className="text-xs text-text">{name}</label>

      <Input
        type="number"
        className="mt-1"
        value={typeof value === 'number' ? value : 0}
        onChange={(e) => {
          const nextValue = Number(e.target.value) || 0

          updateCharacter(character.get('id'), (c) => c.withHp(hpKey, nextValue))
        }}
      />
    </div>
  )
}