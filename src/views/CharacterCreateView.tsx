import { useMemo } from "react"
import { useNavigate } from "react-router-dom"

import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { CharacterCreationWizard } from "../features/characters/creation/characterCreationWizardV6"
import { ensureCharacterBackgroundFromHistory } from "../features/characters/creation/inferCharacterBackground"
import type { Player } from "../models/player/Player"

export function CharacterCreateView() {
  const {
    activeCharacter,
    importCharacter,
    canAssignOwners,
    knownPlayerKeys: playerKeys,
    getOwner,
    createOwner,
  } = useCharacterContext()
  const { userKey } = useSyncContext()
  const navigate = useNavigate()

  const owners = useMemo(
    () => playerKeys.map((key) => getOwner(key)),
    [getOwner, playerKeys],
  )

  const defaultOwner = useMemo(() => {
    const normalizedUserKey = userKey.trim()
    if (normalizedUserKey) return getOwner(normalizedUserKey)
    return activeCharacter?.get("owner") ?? owners[0] ?? createOwner("Jogador local")
  }, [activeCharacter, createOwner, getOwner, owners, userKey])

  const wizardOwners = useMemo(
    () => uniqueOwners([defaultOwner, ...owners]),
    [defaultOwner, owners],
  )

  return (
    <CharacterCreationWizard
      open
      mode="page"
      defaultOwner={defaultOwner}
      owners={wizardOwners}
      canAssignOwners={canAssignOwners}
      createOwner={createOwner}
      onClose={() => navigate("/character")}
      onCreate={(character) => {
        const prepared = ensureCharacterBackgroundFromHistory(character)
        const imported = importCharacter(prepared.toJSON())
        navigate(`/character/${encodeURIComponent(imported.get("id"))}/profile`, {
          replace: true,
        })
      }}
    />
  )
}

function uniqueOwners(owners: Player[]): Player[] {
  const seen = new Set<string>()
  return owners.filter((owner) => {
    const key = owner.id.trim() || owner.name.trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
