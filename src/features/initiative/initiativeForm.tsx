import { useMemo, useState } from "react"
import type { Character } from "../models/types"
import { Button } from "../../components/ui/Button"
import type { InitiativeResult } from './initiative'

type Props = {
  characters: Character[]
  initiativeOrder: InitiativeResult[]
  onAdd: (character: Character, rolledValue: number) => void
}

export function InitiativeForm({
  characters,
  initiativeOrder,
  onAdd,
}: Props) {
  const [characterId, setCharacterId] = useState("")
  const [rolledValue, setRolledValue] = useState("")

  const availableCharacters = useMemo(
    () => characters.filter((character) => {
      const alreadyAdded = initiativeOrder.some((entry) => entry.sourceCharacterId === character.id)
      return character.initiativeMode === 'general' || !alreadyAdded
    }),
    [characters, initiativeOrder],
  )

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    const character = characters.find((c) => c.id === characterId)
    const rolled = parseInt(rolledValue, 10)

    if (!character || Number.isNaN(rolled)) return

    onAdd(character, rolled)

    setRolledValue("")
    setCharacterId("")
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="
        mb-6 flex flex-wrap items-end gap-4 rounded-2xl
        border border-accentBorder bg-accentBg/30 p-4
      "
    >
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <label className="text-sm font-medium text-text">
          Personagem
        </label>

        <select
          value={characterId}
          onChange={(e) => setCharacterId(e.target.value)}
          required
          className="
            rounded-xl border border-accentBorder bg-bg px-3 py-2
            text-text outline-none transition-colors
            focus:border-accent
          "
        >
          <option value="">Selecionar personagem</option>

          {availableCharacters.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex w-[140px] flex-col gap-2">
        <label className="text-sm font-medium text-text">
          Iniciativa
        </label>

        <input
          type="number"
          value={rolledValue}
          onChange={(e) => setRolledValue(e.target.value)}
          required
          placeholder="1d20"
          className="
            rounded-xl border border-accentBorder bg-bg px-3 py-2
            text-text outline-none transition-colors
            focus:border-accent
          "
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={!characterId}
      >
        Adicionar
      </Button>
    </form>
  )
}