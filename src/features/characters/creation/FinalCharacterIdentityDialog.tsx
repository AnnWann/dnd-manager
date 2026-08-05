import { useEffect, useState } from "react"
import { Plus, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type { CharacterRelationship } from "../../../models/characters/characterProfile"

export type FinalCharacterIdentity = {
  name: string
  alignment:
    | "lawful-good"
    | "neutral-good"
    | "chaotic-good"
    | "lawful-neutral"
    | "true-neutral"
    | "chaotic-neutral"
    | "lawful-evil"
    | "neutral-evil"
    | "chaotic-evil"
    | "unaligned"
  backgroundDescription: string
  physicalAppearance: string
  personalityTraits: string
  relationships: CharacterRelationship[]
}

type Props = {
  open: boolean
  initialBackgroundDescription: string
  onCancel: () => void
  onConfirm: (identity: FinalCharacterIdentity) => void
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

export function FinalCharacterIdentityDialog({
  open,
  initialBackgroundDescription,
  onCancel,
  onConfirm,
}: Props) {
  const [name, setName] = useState("")
  const [alignment, setAlignment] =
    useState<FinalCharacterIdentity["alignment"]>("true-neutral")
  const [backgroundDescription, setBackgroundDescription] = useState("")
  const [physicalAppearance, setPhysicalAppearance] = useState("")
  const [personalityTraits, setPersonalityTraits] = useState("")
  const [relationships, setRelationships] = useState<CharacterRelationship[]>([])
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setName("")
    setAlignment("true-neutral")
    setBackgroundDescription(initialBackgroundDescription)
    setPhysicalAppearance("")
    setPersonalityTraits("")
    setRelationships([])
    setError("")
  }, [initialBackgroundDescription, open])

  if (!open) return null

  function addRelationship() {
    if (relationships.length >= 3) return
    setRelationships((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: "",
        relation: "",
        description: "",
      },
    ])
  }

  function updateRelationship(
    id: string,
    field: "name" | "relation" | "description",
    value: string,
  ) {
    setRelationships((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      ),
    )
  }

  function confirm() {
    if (!name.trim()) {
      setError("Informe o nome do personagem.")
      return
    }
    const incompleteRelationship = relationships.find(
      (entry) => !entry.name.trim() || !entry.relation.trim(),
    )
    if (incompleteRelationship) {
      setError("Preencha o nome e o tipo de relação de cada relacionamento adicionado.")
      return
    }

    onConfirm({
      name: name.trim(),
      alignment,
      backgroundDescription: backgroundDescription.trim(),
      physicalAppearance: physicalAppearance.trim(),
      personalityTraits: personalityTraits.trim(),
      relationships: relationships.map((entry) => ({
        ...entry,
        name: entry.name.trim(),
        relation: entry.relation.trim(),
        description: entry.description?.trim() || undefined,
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-5">
      <section className="my-auto grid w-full max-w-5xl gap-5 rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:p-6">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-semibold text-textH">Identidade final</h1>
            <p className="mt-1 text-sm leading-6 text-textMuted">
              Defina a identidade narrativa. A ficha só será salva depois desta confirmação.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onCancel}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-xs text-text">
            Nome do personagem <span className="text-danger">Obrigatório</span>
            <Input
              autoFocus
              value={name}
              className={!name.trim() && error ? "border-danger bg-dangerBg" : ""}
              placeholder="Nome do personagem"
              onChange={(event) => {
                setName(event.target.value)
                setError("")
              }}
            />
          </label>

          <label className="grid gap-1.5 text-xs text-text">
            Alinhamento
            <Select
              value={alignment}
              onChange={(event) =>
                setAlignment(
                  event.target.value as FinalCharacterIdentity["alignment"],
                )
              }
            >
              {ALIGNMENTS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1.5 text-xs text-text md:col-span-2">
            Descrição do antecedente
            <Textarea
              value={backgroundDescription}
              placeholder="Como o antecedente se manifesta na história e na vida atual do personagem?"
              onChange={(event) => setBackgroundDescription(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-xs text-text">
            Aparência física
            <Textarea
              value={physicalAppearance}
              placeholder="Altura, porte, roupas, marcas, cabelo, olhos e outros detalhes visuais."
              onChange={(event) => setPhysicalAppearance(event.target.value)}
            />
          </label>

          <label className="grid gap-1.5 text-xs text-text">
            Traços de personalidade
            <Textarea
              value={personalityTraits}
              placeholder="Hábitos, valores, medos, maneirismos, ideais e defeitos."
              onChange={(event) => setPersonalityTraits(event.target.value)}
            />
          </label>
        </div>

        <section className="rounded-xl border border-border bg-bg-subtle p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-textH">Relacionamentos</h2>
              <p className="mt-1 text-xs text-textMuted">
                Adicione até três pessoas, grupos, rivais, patronos ou vínculos importantes.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={relationships.length >= 3}
              onClick={addRelationship}
            >
              <Plus className="h-4 w-4" />
              Relacionamento
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            {relationships.map((relationship, index) => {
              const invalid =
                Boolean(error) &&
                (!relationship.name.trim() || !relationship.relation.trim())
              return (
                <article
                  key={relationship.id}
                  className={
                    invalid
                      ? "rounded-xl border border-danger bg-dangerBg p-3"
                      : "rounded-xl border border-border bg-bg p-3"
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-textH">
                      Relacionamento {index + 1}
                    </strong>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setRelationships((current) =>
                          current.filter((entry) => entry.id !== relationship.id),
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Remover
                    </Button>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1.5 text-xs text-text">
                      Nome <span className="text-danger">Obrigatório</span>
                      <Input
                        value={relationship.name}
                        placeholder="Nome da pessoa, grupo ou entidade"
                        onChange={(event) => {
                          updateRelationship(
                            relationship.id,
                            "name",
                            event.target.value,
                          )
                          setError("")
                        }}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-text">
                      Relação <span className="text-danger">Obrigatório</span>
                      <Input
                        value={relationship.relation}
                        placeholder="Aliado, rival, familiar, mentor..."
                        onChange={(event) => {
                          updateRelationship(
                            relationship.id,
                            "relation",
                            event.target.value,
                          )
                          setError("")
                        }}
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-text md:col-span-2">
                      Descrição
                      <Textarea
                        value={relationship.description ?? ""}
                        placeholder="História, estado atual e importância desse vínculo."
                        onChange={(event) =>
                          updateRelationship(
                            relationship.id,
                            "description",
                            event.target.value,
                          )
                        }
                      />
                    </label>
                  </div>
                </article>
              )
            })}
            {!relationships.length ? (
              <div className="rounded-lg border border-dashed border-border bg-bg p-4 text-center text-xs text-textMuted">
                Nenhum relacionamento adicionado.
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-danger bg-dangerBg p-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <footer className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
          <Button variant="secondary" onClick={onCancel}>
            Voltar ao criador
          </Button>
          <Button variant="primary" onClick={confirm}>
            Confirmar identidade e criar personagem
          </Button>
        </footer>
      </section>
    </div>
  )
}
