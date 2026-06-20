import { useState } from "react"
import type { ActionType } from "../../../../../../models/actions/Actions"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import { SelectActionModule } from "./selectActionModule"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

const ACTIONS: ActionType[] = [
  "action",
  "bonusAction",
  "reaction",
  "interaction",
  "legendaryAction",
  "legendaryReaction",
  "legendaryResistance",
]

export function GroupActions({
  character,
  updateCharacter,
}: Props) {
  const [open, setOpen] = useState(false)

  return (
    <details className="rounded-xl border border-border bg-bg">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-textH">
        Regras de ações
      </summary>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {ACTIONS.map((action) => (
            <SelectActionModule
              key={action}
              action={action}
              character={character}
              updateCharacter={updateCharacter}
            />
          ))}
        </div>
    </details>
  )
}