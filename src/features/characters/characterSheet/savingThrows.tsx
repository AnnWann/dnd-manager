import { Check } from "lucide-react"

import { cn } from "../../../lib/cn"
import { attributeShort } from "../../../lib/attributeShorts"
import { formatSigned } from "../../../lib/formatSigned"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Attribute } from "../../../models/sheet/Attribute"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (
      character: CharacterTemplate,
    ) => CharacterTemplate,
  ) => void
}

const SAVING_THROWS: Array<{
  attribute: Attribute
  label: string
}> = [
  { attribute: "str", label: "Força" },
  { attribute: "dex", label: "Destreza" },
  { attribute: "con", label: "Constituição" },
  { attribute: "int", label: "Inteligência" },
  { attribute: "wis", label: "Sabedoria" },
  { attribute: "cha", label: "Carisma" },
]

export function SavingThrows({
  character,
  updateCharacter,
}: Props) {
  const { dispatchSavingThrowOperation } = useCharacterWorkspace()
  const characterId = character.get("id")

  function toggleProficiency(attribute: Attribute) {
    const proficient = character.isSavingThrowProficient(attribute)

    if (dispatchSavingThrowOperation({
      type: "character.savingThrow.set",
      characterId,
      attribute,
      proficient: !proficient,
    })) return

    updateCharacter(characterId, (current) =>
      current.setSavingThrowProficiency(attribute, !proficient),
    )
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-textH">
          Testes de Resistência
        </h2>

        <p className="mt-0.5 text-[11px] text-textMuted">
          Clique para alternar proficiência.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SAVING_THROWS.map(({ attribute, label }) => {
          const proficient = character.isSavingThrowProficient(attribute)
          const bonus = character.getSavingThrowBonus(attribute)

          return (
            <button
              key={attribute}
              type="button"
              aria-pressed={proficient}
              title={`${label}: ${proficient ? "proficiente" : "não proficiente"}`}
              onClick={() => toggleProficiency(attribute)}
              className={cn(
                "grid grid-cols-[22px_1fr_auto] items-center gap-2",
                "rounded-lg border px-2.5 py-2 text-left",
                "transition-colors",
                proficient
                  ? "border-accentBorder bg-accentBg"
                  : "border-border bg-bg-subtle hover:border-borderStrong",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center",
                  "rounded-full border",
                  proficient
                    ? "border-accent bg-accent text-white"
                    : "border-textMuted bg-transparent",
                )}
              >
                {proficient ? (
                  <Check
                    aria-hidden="true"
                    className="h-3 w-3"
                    strokeWidth={3}
                  />
                ) : null}
              </span>

              <span className="min-w-0">
                <span className="block text-xs font-semibold text-textH">
                  {attributeShort(attribute)}
                </span>

                <span className="block truncate text-[10px] text-textMuted">
                  {label}
                </span>
              </span>

              <span className="text-sm font-bold text-textH">
                {formatSigned(bonus)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-3 border-t border-border pt-2 text-[10px] text-textMuted">
        Modificador do atributo{" + "}proficiência quando marcada.
      </div>
    </section>
  )
}
