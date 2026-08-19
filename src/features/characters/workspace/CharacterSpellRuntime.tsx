import { useEffect, useMemo, type ReactNode } from "react"

import { useMagicContext } from "../../../contexts/magicContext"
import { collectReferencedSpellIndexes } from "../../../lib/spellReferences"
import { useCharacterWorkspace } from "./CharacterWorkspaceContext"

export function CharacterSpellRuntime({ children }: { children: ReactNode }) {
  const { activeCharacter } = useCharacterWorkspace()
  const { ensureOfficialSpells } = useMagicContext()

  const referencedSpellIndexes = useMemo(
    () =>
      activeCharacter
        ? collectReferencedSpellIndexes(activeCharacter.toJSON())
        : [],
    [activeCharacter],
  )

  const referenceKey = referencedSpellIndexes.join("\u0000")

  useEffect(() => {
    if (!referencedSpellIndexes.length) return
    void ensureOfficialSpells(referencedSpellIndexes)
  }, [ensureOfficialSpells, referenceKey])

  return children
}
