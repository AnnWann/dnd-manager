import { useEffect, useState } from "react"

import { CustomSystemsProvider } from "../contexts/customSystemsContext"
import { MagicProvider } from "../contexts/magicContext"
import type { Spell } from "../models/magic/spells/Spell"
import { AppRouter } from "../Router"

const USER_HOMEBREW_SPELLS_KEY = "dnd-manager:user-homebrew-spells:v1"

export function UserLayout() {
  const [spells, setSpells] = useState<Spell[]>(loadUserSpells)

  useEffect(() => {
    try {
      window.localStorage.setItem(
        USER_HOMEBREW_SPELLS_KEY,
        JSON.stringify(spells),
      )
    } catch {
      // Storage may be unavailable in private or restricted browser contexts.
    }
  }, [spells])

  return (
    <CustomSystemsProvider>
      <MagicProvider
        spells={spells}
        onSpellsChange={setSpells}
      >
        <AppRouter />
      </MagicProvider>
    </CustomSystemsProvider>
  )
}

function loadUserSpells(): Spell[] {
  if (typeof window === "undefined") return []

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(USER_HOMEBREW_SPELLS_KEY) ?? "[]",
    ) as unknown

    return Array.isArray(parsed) ? (parsed as Spell[]) : []
  } catch {
    return []
  }
}
