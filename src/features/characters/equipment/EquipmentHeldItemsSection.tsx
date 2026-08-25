import { useState } from "react"
import { Hand, Sparkles } from "lucide-react"

import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getItemHeldHands } from "../../../models/characters/characterHands"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import {
  HandItemActionsDialog,
  type HandItemActionsDialogState,
} from "../characterSheet/weaponAttackCardActionsDialog"

export function EquipmentHeldItemsSection({
  character,
}: {
  character: CharacterTemplate
}) {
  const { mode, isEditing } = useCharacterWorkspace()
  const [dialogState, setDialogState] =
    useState<HandItemActionsDialogState | null>(null)
  const items = character.get("equipment").heldItems ?? []
  const userMode = mode === "user"
  const canChangeLoadout = !userMode || Boolean(isEditing)

  return (
    <section>
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-textH">
          <Hand className="h-4 w-4 text-accent" />
          Itens nas mãos
        </div>
        <div className="mt-1 text-xs text-textMuted">
          {userMode
            ? "Itens atualmente segurados pelo personagem."
            : "Toque em qualquer item para mudar entre uma ou duas mãos, guardar ou largar."}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-subtle px-4 py-5 text-center text-xs text-textMuted">
          Nenhum item adicional está sendo segurado.
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item, index) => {
            const hands = getItemHeldHands(item)
            const content = (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-textH">
                    {item.name || "Item sem nome"}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-textMuted">
                    <span>{hands} {hands === 1 ? "mão" : "mãos"}</span>
                    {item.kind === "focus" ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 font-semibold text-accent">
                        <Sparkles className="h-3 w-3" />
                        Foco arcano
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            )

            if (!canChangeLoadout) {
              return (
                <div
                  key={`${item.id}-${index}`}
                  className="rounded-xl border border-border bg-bg-subtle p-3 text-left"
                >
                  {content}
                </div>
              )
            }

            return (
              <button
                key={`${item.id}-${index}`}
                type="button"
                onClick={() => setDialogState({ itemId: item.id })}
                className="rounded-xl border border-border bg-bg-subtle p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {content}
              </button>
            )
          })}
        </div>
      )}

      {canChangeLoadout ? (
        <HandItemActionsDialog
          character={character}
          state={dialogState}
          onClose={() => setDialogState(null)}
        />
      ) : null}
    </section>
  )
}
