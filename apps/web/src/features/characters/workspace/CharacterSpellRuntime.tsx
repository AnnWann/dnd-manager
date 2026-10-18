import { useEffect, type ReactNode } from "react"

import { useMagicContext } from "../../../contexts/magicContext"
import { collectReferencedSpellIndexes } from "../../../lib/spellReferences"
import { useCharacterWorkspace } from "./CharacterWorkspaceContext"

export function CharacterSpellRuntime({ children }: { children: ReactNode }) {
  const { activeCharacter } = useCharacterWorkspace()
  const { ensureOfficialSpells } = useMagicContext()

  // CharacterTemplate can retain its object identity while a domain is
  // hydrated or replaced. Recompute references on each render so official
  // spells added by those updates are not left out of the loader.
  const referencedSpellIndexes = activeCharacter
    ? collectReferencedSpellIndexes(activeCharacter.toJSON())
    : []

  const referenceKey = referencedSpellIndexes.join("\u0000")

  useEffect(() => {
    if (!referencedSpellIndexes.length) return
    void ensureOfficialSpells(referencedSpellIndexes)
  }, [ensureOfficialSpells, referenceKey])

  return children
}
