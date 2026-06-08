import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { DieSides } from "../../../../../../models/dice/Die"
import type { HitDice } from "../../../../../../models/sheet/HitDice"

type Props = {
  side: DieSides
  hitDice: HitDice
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function HitDiceRow({
  side,
  hitDice,
  character,
  updateCharacter,
}: Props) {
  return (
    <div className="grid grid-cols-[1fr_80px_80px_32px] items-center gap-2">
      <span className="text-sm text-text">
        {hitDice.current.quantity}
        {side} / {hitDice.max.quantity}
        {side}
      </span>

      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-text"
        onClick={() =>
          updateCharacter(character.get("id"), (c) => {
            const hp = c.get("sheet").HP
            const current = hp.hitDice[side]

            return c.withHp("hitDice", {
              ...hp.hitDice,
              [side]: {
                ...current,
                current: {
                  ...current?.current,
                  quantity: Math.max(0, (current?.current.quantity ?? 0) - 1),
                },
              },
            })
          })
        }
      >
        Usar
      </button>

      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-text"
        onClick={() =>
          updateCharacter(character.get("id"), (c) => {
            const hp = c.get("sheet").HP
            const current = hp.hitDice[side]

            return c.withHp("hitDice", {
              ...hp.hitDice,
              [side]: {
                ...current,
                current: {
                  ...current?.current,
                  quantity: Math.min(
                    (current?.max.quantity ?? 0),
                    (current?.current.quantity ?? 0) + 1,
                  ),
                },
              },
            })
          })
        }
      >
        Rec.
      </button>

      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs text-text"
        onClick={() =>
          updateCharacter(character.get("id"), (c) => {
            const hp = c.get("sheet").HP
            const next = { ...hp.hitDice }

            delete next[side]

            return c.withHp("hitDice", next)
          })
        }
      >
        ✕
      </button>
    </div>
  )
}