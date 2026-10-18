import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react"
import { createPortal } from "react-dom"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import { Select } from "../../../../components/ui/Select"
import { Textarea } from "../../../../components/ui/Textarea"
import type { CharacterRelationship } from "../../../../models/characters/characterProfile"
import type { CharacterCreationIdentity } from "../../../../models/characters/creation/CharacterCreation"
import {
  CHARACTER_ALIGNMENT_OPTIONS,
  CHARACTER_RACE_LABELS,
} from "../../../../data/characterCreation/identityOptions"

type Props = {
  open: boolean
  value: CharacterCreationIdentity
  onChange: (value: CharacterCreationIdentity) => void
  externalError?: string
}

export function CharacterCreationIdentityStep({
  open,
  value,
  onChange,
  externalError = "",
}: Props) {
  const [host, setHost] = useState<HTMLElement | null>(null)
  const hostRef = useRef<HTMLElement | null>(null)
  const nameRef = useRef(value.name)

  useEffect(() => {
    nameRef.current = value.name
    const reviewSection = findReviewSection()
    if (reviewSection) updateReviewName(reviewSection, value.name)
  }, [value.name])

  useEffect(() => {
    if (!open) return

    let frame = 0
    const locate = () => {
      const reviewSection = findReviewSection()
      const parent = reviewSection?.parentElement

      if (!reviewSection || !parent) {
        removeHost(hostRef, setHost)
        return
      }

      if (!hostRef.current?.isConnected) {
        const nextHost = document.createElement("div")
        nextHost.dataset.characterCreationIdentityStep = "true"
        nextHost.className = "w-full min-w-0 max-w-full overflow-x-hidden"
        parent.insertBefore(nextHost, reviewSection)
        hostRef.current = nextHost
        setHost(nextHost)
      }

      localizeReviewRace(reviewSection)
      updateReviewName(reviewSection, nameRef.current)
    }
    const scheduleLocate = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(locate)
    }

    locate()
    const observer = new MutationObserver(scheduleLocate)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      removeHost(hostRef, setHost)
    }
  }, [open])

  if (!host) return null

  const patch = (next: Partial<CharacterCreationIdentity>) =>
    onChange({ ...value, ...next })

  const updateRelationship = (
    id: string,
    next: Partial<CharacterRelationship>,
  ) => {
    patch({
      relationships: value.relationships.map((entry) =>
        entry.id === id ? { ...entry, ...next } : entry,
      ),
    })
  }

  return createPortal(
    <section className="mb-4 w-full min-w-0 max-w-full overflow-x-hidden rounded-xl border border-accentBorder bg-accentBg p-3 sm:p-4">
      <h2 className="font-semibold text-textH">Identidade</h2>
      <p className="mt-1 text-xs leading-5 text-textMuted">
        Defina a identidade narrativa antes de confirmar e criar a ficha.
      </p>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-xs text-text">
          Nome do personagem <span className="text-danger">Obrigatório</span>
          <Input
            value={value.name}
            invalid={Boolean(externalError && !value.name.trim())}
            placeholder="Nome do personagem"
            onChange={(event) => patch({ name: event.target.value })}
          />
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs text-text">
          Alinhamento
          <Select
            value={value.alignment}
            onChange={(event) =>
              patch({
                alignment:
                  event.target.value as CharacterCreationIdentity["alignment"],
              })
            }
          >
            {CHARACTER_ALIGNMENT_OPTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs text-text md:col-span-2">
          Descrição do antecedente
          <Textarea
            value={value.backgroundDescription}
            placeholder="Como o antecedente moldou a história e a vida atual do personagem?"
            onChange={(event) =>
              patch({ backgroundDescription: event.target.value })
            }
          />
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs text-text">
          Aparência física
          <Textarea
            value={value.physicalAppearance}
            placeholder="Altura, porte, roupas, marcas, cabelo, olhos e outros detalhes visuais."
            onChange={(event) => patch({ physicalAppearance: event.target.value })}
          />
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs text-text">
          Traços de personalidade
          <Textarea
            value={value.personalityTraits}
            placeholder="Hábitos, valores, medos, maneirismos, ideais e defeitos."
            onChange={(event) => patch({ personalityTraits: event.target.value })}
          />
        </label>
      </div>

      <RelationshipsEditor
        relationships={value.relationships}
        showErrors={Boolean(externalError)}
        onAdd={() =>
          patch({
            relationships: [
              ...value.relationships,
              {
                id: crypto.randomUUID(),
                name: "",
                relation: "",
                description: "",
              },
            ],
          })
        }
        onRemove={(id) =>
          patch({
            relationships: value.relationships.filter(
              (entry) => entry.id !== id,
            ),
          })
        }
        onUpdate={updateRelationship}
      />

      {externalError ? (
        <div className="mt-4 rounded-lg border border-danger bg-dangerBg p-3 text-sm text-danger">
          {externalError}
        </div>
      ) : null}
    </section>,
    host,
  )
}

function RelationshipsEditor({
  relationships,
  showErrors,
  onAdd,
  onRemove,
  onUpdate,
}: {
  relationships: CharacterRelationship[]
  showErrors: boolean
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, next: Partial<CharacterRelationship>) => void
}) {
  return (
    <div className="mt-5 min-w-0 rounded-xl border border-border bg-bg p-3 sm:p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-textH">Relacionamentos</h3>
          <p className="mt-1 text-xs text-textMuted">
            Adicione até três vínculos importantes do personagem.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="w-full shrink-0 sm:w-auto"
          disabled={relationships.length >= 3}
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" />
          Relacionamento
        </Button>
      </div>

      <div className="mt-3 grid min-w-0 gap-3">
        {relationships.map((relationship, index) => {
          const invalid =
            showErrors &&
            (!relationship.name.trim() || !relationship.relation.trim())

          return (
            <article
              key={relationship.id}
              className={
                invalid
                  ? "min-w-0 rounded-xl border border-danger bg-dangerBg p-3"
                  : "min-w-0 rounded-xl border border-border bg-bg-subtle p-3"
              }
            >
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <strong className="min-w-0 text-sm text-textH">
                  Relacionamento {index + 1}
                </strong>
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full shrink-0 sm:w-auto"
                  onClick={() => onRemove(relationship.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                <label className="grid min-w-0 gap-1.5 text-xs text-text">
                  Nome <span className="text-danger">Obrigatório</span>
                  <Input
                    value={relationship.name}
                    invalid={showErrors && !relationship.name.trim()}
                    placeholder="Pessoa, grupo ou entidade"
                    onChange={(event) =>
                      onUpdate(relationship.id, { name: event.target.value })
                    }
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-xs text-text">
                  Relação <span className="text-danger">Obrigatório</span>
                  <Input
                    value={relationship.relation}
                    invalid={showErrors && !relationship.relation.trim()}
                    placeholder="Aliado, rival, familiar, mentor..."
                    onChange={(event) =>
                      onUpdate(relationship.id, { relation: event.target.value })
                    }
                  />
                </label>
                <label className="grid min-w-0 gap-1.5 text-xs text-text md:col-span-2">
                  Descrição
                  <Textarea
                    value={relationship.description ?? ""}
                    placeholder="História e importância desse vínculo."
                    onChange={(event) =>
                      onUpdate(relationship.id, {
                        description: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            </article>
          )
        })}

        {!relationships.length ? (
          <div className="min-w-0 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
            Nenhum relacionamento adicionado.
          </div>
        ) : null}
      </div>
    </div>
  )
}

function findReviewSection(): HTMLElement | null {
  const heading = Array.from(
    document.querySelectorAll<HTMLElement>("main h2"),
  ).find((entry) => entry.textContent?.trim() === "Confirmar personagem")
  return heading?.closest<HTMLElement>("section") ?? null
}

function localizeReviewRace(section: HTMLElement) {
  const row = findReviewRow(section, "Raça")
  const value = row?.querySelector<HTMLElement>("strong")
  if (!value) return

  const raw = value.textContent?.trim() ?? ""
  const localized =
    CHARACTER_RACE_LABELS[raw] ??
    CHARACTER_RACE_LABELS[raw.toLocaleLowerCase("en-US")] ??
    raw
  if (value.textContent !== localized) value.textContent = localized
}

function updateReviewName(section: HTMLElement, name: string) {
  const value = findReviewRow(section, "Nome")?.querySelector<HTMLElement>(
    "strong",
  )
  const next = name.trim() || "—"
  if (value && value.textContent !== next) value.textContent = next
}

function findReviewRow(
  section: HTMLElement,
  label: string,
): HTMLElement | undefined {
  return Array.from(section.querySelectorAll<HTMLElement>("div")).find(
    (entry) => entry.children[0]?.textContent?.trim() === label,
  )
}

function removeHost(
  hostRef: MutableRefObject<HTMLElement | null>,
  setHost: (host: HTMLElement | null) => void,
) {
  hostRef.current?.remove()
  hostRef.current = null
  setHost(null)
}
