import { useState } from "react"
import { createPortal } from "react-dom"
import type { CharacterTemplate } from "../../../../models/characters/CharacterTemplate"
import { getTotalCharacterLevel } from "../../../../models/characters/CharacterProgression"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { trimSingleLine } from "../../../../lib/textNormalization"
import { CLASS_NAMES } from "../../../../contexts/consts"
import { Classes } from "../classes/class"
import { CharacterExperience } from "../characterExperience"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function CharacterIdentity({
  character,
  updateCharacter,
}: Props) {
  const [classEditorOpen, setClassEditorOpen] = useState(false)
  const classes = character.get("sheet").classes ?? []
  const totalLevel = getTotalCharacterLevel(character)
  const classDescription =
    classes.length > 0
      ? classes
          .map(
            (characterClass) =>
              `${CLASS_NAMES[characterClass.className]} ${characterClass.level}`,
          )
          .join(" / ")
      : "Sem classe"
  const canEditClasses = character.get("sheet").type === "pc"

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-textMuted">
            Nome do personagem
          </span>

          <Input
            className="h-12 text-lg font-semibold"
            value={character.get("name")}
            onChange={(event) =>
              updateCharacter(character.get("id"), (current) =>
                current.with("name", event.target.value),
              )
            }
            onBlur={(event) =>
              updateCharacter(character.get("id"), (current) =>
                current.with("name", trimSingleLine(event.target.value)),
              )
            }
          />
        </label>

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <button
            type="button"
            disabled={!canEditClasses}
            className={
              canEditClasses
                ? "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left transition hover:border-accentBorder hover:bg-accentBg"
                : "rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left"
            }
            title={
              canEditClasses
                ? "Editar classes"
                : "Apenas personagens jogadores usam editor de classe"
            }
            onClick={() => {
              if (canEditClasses) setClassEditorOpen(true)
            }}
          >
            <div className="text-xs uppercase tracking-wide text-textMuted">
              Classe
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-textH">
              {classDescription}
            </div>
            {canEditClasses ? (
              <div className="mt-1 text-[11px] text-textMuted">
                Clique para editar
              </div>
            ) : null}
          </button>

          <div className="flex min-w-20 flex-col items-center justify-center rounded-lg border border-accentBorder bg-accentBg px-3">
            <span className="text-xs uppercase tracking-wide text-textMuted">
              Nível
            </span>
            <strong className="text-xl text-textH">{totalLevel}</strong>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <CharacterExperience
          character={character}
          updateCharacter={updateCharacter}
        />
      </div>

      <ClassEditorModal
        open={classEditorOpen}
        character={character}
        updateCharacter={updateCharacter}
        onClose={() => setClassEditorOpen(false)}
      />
    </section>
  )
}

function ClassEditorModal({
  open,
  character,
  updateCharacter,
  onClose,
}: {
  open: boolean
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
  onClose: () => void
}) {
  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden bg-black/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-editor-title"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <div className="grid max-h-[calc(100dvh-1.5rem)] w-full min-w-0 max-w-5xl gap-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)] sm:p-4">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div>
            <h2 id="class-editor-title" className="break-words text-sm font-semibold text-textH">
              Editar classes
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Ajuste a progressão de classe de {character.get("name") || "personagem"}.
              O nível total não pode passar de 20.
            </p>
          </div>

          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <Classes character={character} updateCharacter={updateCharacter} />
      </div>
    </div>,
    document.body,
  )
}
