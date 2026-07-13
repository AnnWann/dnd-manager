import { Button } from "../../../components/ui/Button"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getCharacterCarriedItems,
  toggleInventoryItemAttunement,
} from "../../../models/characters/characterInventory"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function EquipmentAttunementSection({
  character,
  updateCharacter,
}: Props) {
  const attunedItems = getCharacterCarriedItems(character)
    .filter((item) => item.attuned === true)
    .slice(0, 3)
  const slots = Array.from({ length: 3 }, (_, index) => attunedItems[index])

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-textH">
          Itens mágicos sintonizados
        </div>
        <div className="text-xs leading-5 text-textMuted">
          A sintonia não depende de o item estar equipado ou guardado no
          inventário. Ela apenas ocupa um dos três espaços de sintonia do
          personagem.
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {slots.map((item, index) => (
          <div
            key={item?.id ?? `empty-attunement-${index}`}
            className="min-h-24 rounded-lg border border-border bg-bg-subtle p-3"
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-textMuted">
              Sintonia {index + 1}
            </div>

            {item ? (
              <>
                <div className="mt-2 break-words text-sm font-semibold text-textH">
                  {item.name || "Item sem nome"}
                </div>
                <div className="mt-1 text-xs text-textMuted">
                  Item mágico sintonizado
                </div>
                <Button
                  className="mt-3"
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    updateCharacter(character.get("id"), (current) =>
                      toggleInventoryItemAttunement(current, item.id),
                    )
                  }
                >
                  Desfazer sintonia
                </Button>
              </>
            ) : (
              <div className="mt-2 text-sm text-textMuted">Espaço vazio</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
