import { useState } from "react"
import { useOptionalSessionRuntime } from "../../../../session-runtime/useSessionRuntime"
import type {
  SessionAuthoritativeOperation,
  SessionDieSides,
} from "../../../../session-runtime/sessionProtocol"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"
import type { DieSides } from "../../../../../../models/dice/Die"
import { AddHitDiceDialog } from "./addHitDiceDialog"
import { HitDiceRow } from "./hitDiceRow"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate
  ) => void
}

export function GroupHitDice({ character, updateCharacter }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const runtime = useOptionalSessionRuntime()
  const characterId = character.get("id")
  const localHitDice = character.get("sheet").HP.hitDice
  const authoritative = runtime?.hpByCharacterId[characterId]?.hitDice

  const hitDiceEntries = authoritative
    ? Object.entries(authoritative).flatMap(([side, pool]) =>
        pool ? [[side as DieSides, pool] as const] : [],
      )
    : Object.entries(localHitDice).flatMap(([side, pool]) =>
        pool
          ? [[side as DieSides, { current: pool.current.quantity, max: pool.max.quantity }] as const]
          : [],
      )

  function sendRuntimeOperation(operation: SessionAuthoritativeOperation) {
    if (!runtime) return false
    if (runtime.status !== "connected") {
      console.warn("[session-runtime] Hit-dice change ignored while the authoritative session server is disconnected.")
      return true
    }
    runtime.dispatchHpOperation(operation)
    return true
  }

  function useDie(side: DieSides) {
    if (sendRuntimeOperation({
      type: "character.hitDice.use",
      characterId,
      side: side as SessionDieSides,
      amount: 1,
    })) return

    updateCharacter(characterId, (c) => c.spendHitDie(side))
  }

  function recoverDie(side: DieSides) {
    if (sendRuntimeOperation({
      type: "character.hitDice.recover",
      characterId,
      side: side as SessionDieSides,
      amount: 1,
    })) return

    updateCharacter(characterId, (c) => c.restoreHitDie(side))
  }

  function removeDie(side: DieSides) {
    if (sendRuntimeOperation({
      type: "character.hitDice.remove",
      characterId,
      side: side as SessionDieSides,
    })) return

    updateCharacter(characterId, (c) => {
      const hp = c.get("sheet").HP
      const next = { ...hp.hitDice }
      delete next[side]
      return c.withHp("hitDice", next)
    })
  }

  return (
    <div className="col-span-2 lg:col-span-3">
      <div className="mt-2 flex flex-col gap-2">
        {hitDiceEntries.map(([side, pool]) => (
          <HitDiceRow
            key={side}
            side={side}
            current={pool.current}
            max={pool.max}
            onUse={() => useDie(side)}
            onRecover={() => recoverDie(side)}
            onRemove={() => removeDie(side)}
          />
        ))}

        <button
          type="button"
          className="mt-2 w-fit rounded-md border border-border px-2 py-1 text-xs text-text"
          onClick={() => setDialogOpen(true)}
        >
          + Adicionar
        </button>

        <AddHitDiceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onAdd={(die) => {
            if (sendRuntimeOperation({
              type: "character.hitDice.add",
              characterId,
              side: die.sides as SessionDieSides,
              amount: die.quantity,
            })) return

            updateCharacter(characterId, (c) => c.addDice(die))
          }}
        />
      </div>
    </div>
  )
}
