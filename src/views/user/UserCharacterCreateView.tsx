import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { createMyCharacter } from "../../api/user-characters"
import { CharacterCreationWizard } from "../../features/characters/creation/characterCreationWizard"
import { ensureCharacterBackgroundFromHistory } from "../../lib/characterCreation/inferCharacterBackground"
import type { Player } from "../../models/player/Player"

const USER_OWNER: Player = {
  id: "current-user",
  name: "Jogador",
  role: "player",
}

export function UserCharacterCreateView() {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const owners = useMemo(() => [USER_OWNER], [])

  return (
    <div className="mx-auto w-full max-w-6xl">
      {errorMessage ? (
        <div className="mb-4 rounded-xl border border-danger bg-dangerBg px-4 py-3 text-sm text-danger">
          {errorMessage}
        </div>
      ) : null}

      <div className={saving ? "pointer-events-none opacity-70" : undefined}>
        <CharacterCreationWizard
          open
          mode="page"
          defaultOwner={USER_OWNER}
          owners={owners}
          canAssignOwners={false}
          createOwner={(name) => ({
            id: crypto.randomUUID(),
            name: name.trim() || "Jogador",
            role: "player",
          })}
          onClose={() => navigate("/user/characters")}
          onCreate={async (character) => {
            if (saving) return

            setSaving(true)
            setErrorMessage("")

            try {
              const prepared = ensureCharacterBackgroundFromHistory(character)
              const data = prepared.toJSON() as Record<string, unknown>
              const created = await createMyCharacter({
                name: prepared.get("name").trim() || "Novo personagem",
                visibility: "PRIVATE",
                data,
              })

              navigate(
                `/user/characters/${encodeURIComponent(created.id)}/profile`,
                { replace: true },
              )
            } catch (error) {
              setErrorMessage(
                error instanceof Error
                  ? error.message
                  : "Não foi possível criar o personagem.",
              )
              setSaving(false)
            }
          }}
        />
      </div>
    </div>
  )
}
