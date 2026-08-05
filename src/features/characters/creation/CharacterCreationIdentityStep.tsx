import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Trash2 } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type { CharacterRelationship } from "../../../models/characters/characterProfile"
import type { FinalCharacterIdentity } from "./FinalCharacterIdentityDialog"

type Props = {
  open: boolean
  value: FinalCharacterIdentity
  onChange: (value: FinalCharacterIdentity) => void
  externalError?: string
}

const ALIGNMENTS: Array<{
  value: FinalCharacterIdentity["alignment"]
  label: string
}> = [
  { value: "lawful-good", label: "Leal e Bom" },
  { value: "neutral-good", label: "Neutro e Bom" },
  { value: "chaotic-good", label: "Caótico e Bom" },
  { value: "lawful-neutral", label: "Leal e Neutro" },
  { value: "true-neutral", label: "Neutro" },
  { value: "chaotic-neutral", label: "Caótico e Neutro" },
  { value: "lawful-evil", label: "Leal e Mau" },
  { value: "neutral-evil", label: "Neutro e Mau" },
  { value: "chaotic-evil", label: "Caótico e Mau" },
  { value: "unaligned", label: "Sem alinhamento" },
]

const RACE_LABELS: Record<string, string> = {
  custom: "Personalizada",
  aarakocra: "Aarakocra",
  aasimar: "Aasimar",
  bugbear: "Bugbear",
  centaur: "Centauro",
  changeling: "Metamorfo",
  dragonborn: "Draconato",
  dwarf: "Anão",
  duergar: "Duergar",
  elf: "Elfo",
  eladrin: "Eladrin",
  fairy: "Fada",
  firbolg: "Firbolg",
  genasi: "Genasi",
  giff: "Giff",
  githyanki: "Githyanki",
  githzerai: "Githzerai",
  gnome: "Gnomo",
  "deep-gnome": "Gnomo das Profundezas",
  goblin: "Goblin",
  goliath: "Golias",
  "half-elf": "Meio-Elfo",
  "half-giant": "Meio-Gigante",
  "half-orc": "Meio-Orc",
  halfling: "Halfling",
  harengon: "Heregon",
  hobgoblin: "Hobgoblin",
  human: "Humano",
  kenku: "Kenku",
  kobold: "Kobold",
  leonin: "Leonino",
  lizardfolk: "Povo-Lagarto",
  loxodon: "Loxodon",
  minotaur: "Minotauro",
  orc: "Orc",
  owlin: "Corujino",
  satyr: "Sátiro",
  "shadar-kai": "Shadar-kai",
  shifter: "Transmorfo",
  tabaxi: "Tabaxi",
  "thri-kreen": "Thri-kreen",
  tiefling: "Tiefling",
  tortle: "Tortle",
  triton: "Tritão",
  vedalken: "Vedalken",
  verdan: "Verdan",
  warforged: "Forjado Bélico",
  "yuan-ti": "Yuan-ti",
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

    const locate = () => {
      const reviewSection = findReviewSection()
      const parent = reviewSection?.parentElement

      if (!reviewSection || !parent) {
        if (hostRef.current) {
          hostRef.current.remove()
          hostRef.current = null
          setHost(null)
        }
        return
      }

      if (!hostRef.current || !hostRef.current.isConnected) {
        const nextHost = document.createElement("div")
        nextHost.dataset.characterCreationIdentityStep = "true"
        nextHost.className = "min-w-0 max-w-full overflow-x-hidden"
        parent.insertBefore(nextHost, reviewSection)
        hostRef.current = nextHost
        setHost(nextHost)
      }

      localizeReviewRace(reviewSection)
      updateReviewName(reviewSection, nameRef.current)
    }

    locate()
    const interval = window.setInterval(locate, 250)
    return () => {
      window.clearInterval(interval)
      hostRef.current?.remove()
      hostRef.current = null
      setHost(null)
    }
  }, [open])

  if (!host) return null

  function patch(patchValue: Partial<FinalCharacterIdentity>) {
    onChange({ ...value, ...patchValue })
  }

  function updateRelationship(
    id: string,
    patchValue: Partial<CharacterRelationship>,
  ) {
    patch({
      relationships: value.relationships.map((entry) =>
        entry.id === id ? { ...entry, ...patchValue } : entry,
      ),
    })
  }

  return createPortal(
    <section className="mb-4 min-w-0 max-w-full overflow-x-hidden rounded-xl border border-accentBorder bg-accentBg p-3 sm:p-4">
      <h2 className="font-semibold text-textH">Identidade</h2>
      <p className="mt-1 max-w-full text-xs leading-5 text-textMuted">
        Defina a identidade narrativa antes de confirmar e criar a ficha.
      </p>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="grid min-w-0 gap-1.5 text-xs text-text">
          Nome do personagem <span className="text-danger">Obrigatório</span>
          <Input
            value={value.name}
            className={
              externalError && !value.name.trim()
                ? "border-danger bg-dangerBg"
                : ""
            }
            placeholder="Nome do personagem"
            onChange={(event) => {
              if (
                !event.nativeEvent.isTrusted &&
                event.target.value === "Personagem em criação"
              ) {
                return
              }
              patch({ name: event.target.value })
            }}
          />
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs text-text">
          Alinhamento
          <Select
            value={value.alignment}
            onChange={(event) =>
              patch({
                alignment:
                  event.target.value as FinalCharacterIdentity["alignment"],
              })
            }
          >
            {ALIGNMENTS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid min-w-0 gap-1.5 text-xs text-text sm:col-span-2">
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

      <div className="mt-5 min-w-0 max-w-full rounded-xl border border-border bg-bg p-3 sm:p-4">
        <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-textH">Relacionamentos</h3>
            <p className="mt-1 text-xs text-textMuted">
              Adicione até três vínculos importantes do personagem.
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={value.relationships.length >= 3}
            onClick={() =>
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
          >
            <Plus className="h-4 w-4" />
            Relacionamento
          </Button>
        </div>

        <div className="mt-3 grid min-w-0 gap-3">
          {value.relationships.map((relationship, index) => {
            const invalid =
              Boolean(externalError) &&
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
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <strong className="text-sm text-textH">
                    Relacionamento {index + 1}
                  </strong>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      patch({
                        relationships: value.relationships.filter(
                          (entry) => entry.id !== relationship.id,
                        ),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    Remover
                  </Button>
                </div>
                <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="grid min-w-0 gap-1.5 text-xs text-text">
                    Nome <span className="text-danger">Obrigatório</span>
                    <Input
                      value={relationship.name}
                      placeholder="Pessoa, grupo ou entidade"
                      onChange={(event) =>
                        updateRelationship(relationship.id, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs text-text">
                    Relação <span className="text-danger">Obrigatório</span>
                    <Input
                      value={relationship.relation}
                      placeholder="Aliado, rival, familiar, mentor..."
                      onChange={(event) =>
                        updateRelationship(relationship.id, {
                          relation: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="grid min-w-0 gap-1.5 text-xs text-text sm:col-span-2">
                    Descrição
                    <Textarea
                      value={relationship.description ?? ""}
                      placeholder="História e importância desse vínculo."
                      onChange={(event) =>
                        updateRelationship(relationship.id, {
                          description: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>
              </article>
            )
          })}
          {!value.relationships.length ? (
            <div className="min-w-0 rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">
              Nenhum relacionamento adicionado.
            </div>
          ) : null}
        </div>
      </div>

      {externalError ? (
        <div className="mt-4 max-w-full rounded-lg border border-danger bg-dangerBg p-3 text-sm text-danger">
          {externalError}
        </div>
      ) : null}
    </section>,
    host,
  )
}

function findReviewSection(): HTMLElement | null {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("main h2"))
    .find((entry) => entry.textContent?.trim() === "Confirmar personagem")
  return heading?.closest<HTMLElement>("section") ?? null
}

function localizeReviewRace(section: HTMLElement) {
  const rows = Array.from(section.querySelectorAll<HTMLElement>("div"))
  const row = rows.find((entry) => {
    const children = Array.from(entry.children)
    return children[0]?.textContent?.trim() === "Raça"
  })
  const value = row?.querySelector<HTMLElement>("strong")
  if (!value) return
  const raw = value.textContent?.trim() ?? ""
  value.textContent =
    RACE_LABELS[raw] ??
    RACE_LABELS[raw.toLocaleLowerCase("en-US")] ??
    raw
}

function updateReviewName(section: HTMLElement, name: string) {
  const rows = Array.from(section.querySelectorAll<HTMLElement>("div"))
  const row = rows.find((entry) => {
    const children = Array.from(entry.children)
    return children[0]?.textContent?.trim() === "Nome"
  })
  const value = row?.querySelector<HTMLElement>("strong")
  if (value) value.textContent = name.trim() || "—"
}