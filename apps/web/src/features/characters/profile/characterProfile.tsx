import { ImagePlus, Trash2, UserRound } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type {
  CharacterAlignment,
  CharacterRelationship,
} from "../../../models/characters/characterProfile"


type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

const MAX_IMAGE_SIZE_MB = 1.5
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

const ALIGNMENT_OPTIONS: Array<{
  value: CharacterAlignment
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

export function CharacterProfileTab({
  character,
  updateCharacter,
}: Props) {
  const profile = character.get("profile")

  function updateProfile<K extends keyof typeof profile>(
    key: K,
    value: (typeof profile)[K],
  ) {
    updateCharacter(character.get("id"), (current) =>
      current.withProfile(key, value),
    )
  }

  function addRelationship() {
    const relationship: CharacterRelationship = {
      id: crypto.randomUUID(),
      name: "",
      relation: "",
      description: "",
    }

    updateProfile("relationships", [
      ...profile.relationships,
      relationship,
    ])
  }

  function updateRelationship(
    relationshipId: string,
    patch: Partial<CharacterRelationship>,
  ) {
    updateProfile(
      "relationships",
      profile.relationships.map((relationship) =>
        relationship.id === relationshipId
          ? { ...relationship, ...patch }
          : relationship,
      ),
    )
  }

  function removeRelationship(relationshipId: string) {
    updateProfile(
      "relationships",
      profile.relationships.filter(
        (relationship) => relationship.id !== relationshipId,
      ),
    )
  }

  async function uploadImage(file: File | undefined) {
    if (!file) return

    if (!file.type.startsWith("image/")) {
      window.alert("Selecione uma imagem.")
      return
    }

    const response = await fetch(
      `/api/images/upload?filename=${encodeURIComponent(file.name)}`,
      {
        method: "POST",
        headers: {
          "content-type": file.type,
        },
        body: file,
      },
    )

    if (!response.ok) {
      const error = await response.json().catch(() => null)
      window.alert(error?.error ?? "Falha ao enviar imagem.")
      return
    }

    const result = (await response.json()) as {
      url: string
      pathname?: string
    }

    updateProfile("imageUrl", result.url)
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="grid gap-3">
            <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border border-border bg-bg-subtle">
              {profile.imageUrl ? (
                <img
                  src={profile.imageUrl}
                  alt={`Retrato de ${character.get("name")}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid justify-items-center gap-2 text-textMuted">
                  <UserRound className="h-12 w-12" />
                  <div className="text-xs">Sem imagem</div>
                </div>
              )}
            </div>

            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  uploadImage(event.target.files?.[0])
                }
              />

              <span className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-bg text-sm font-medium text-textH shadow-theme-sm transition-colors hover:border-borderStrong hover:bg-bg-subtle">
                <ImagePlus className="h-4 w-4" />
                Importar imagem
              </span>
            </label>

            {profile.imageUrl ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => updateProfile("imageUrl", undefined)}
              >
                Remover imagem
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4">
            <div>
              <h2 className="text-base font-semibold text-textH">
                Perfil do personagem
              </h2>

              <p className="mt-1 text-xs text-textMuted">
                Aparência, personalidade, história e vínculos narrativos.
              </p>
            </div>

            <label className="grid max-w-sm gap-1.5">
              <span className="text-xs font-medium text-textH">
                Alinhamento
              </span>
              <Select
                value={profile.alignment ?? ""}
                onChange={(event) =>
                  updateProfile(
                    "alignment",
                    event.target.value
                      ? (event.target.value as CharacterAlignment)
                      : undefined,
                  )
                }
              >
                <option value="">Não definido</option>
                {ALIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">
                Traços de personalidade
              </span>

              <Textarea
                value={profile.traits}
                placeholder="Como o personagem age, fala, pensa, reage ou se apresenta?"
                onChange={(event) =>
                  updateProfile("traits", event.target.value)
                }
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">
                Aparência física
              </span>

              <Textarea
                value={profile.physicalAppearance}
                placeholder="Altura, corpo, cabelo, olhos, roupas, marcas, postura, aura..."
                onChange={(event) =>
                  updateProfile(
                    "physicalAppearance",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <label className="grid gap-1.5">
          <span className="text-sm font-semibold text-textH">
            História
          </span>

          <Textarea
            className="min-h-48"
            value={profile.history}
            placeholder="Origem, eventos importantes, conflitos, objetivos, medos, promessas, segredos..."
            onChange={(event) =>
              updateProfile("history", event.target.value)
            }
          />
        </label>
      </section>

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">
              Relações
            </h2>

            <p className="mt-1 text-xs text-textMuted">
              Aliados, família, rivais, patronos, inimigos e vínculos importantes.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={addRelationship}
          >
            Adicionar relação
          </Button>
        </div>

        {profile.relationships.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {profile.relationships.map((relationship) => (
              <div
                key={relationship.id}
                className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">
                      Nome
                    </span>

                    <Input
                      value={relationship.name}
                      placeholder="Ex: Irmã Grace"
                      onChange={(event) =>
                        updateRelationship(relationship.id, {
                          name: event.target.value,
                        })
                      }
                    />
                  </label>

                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">
                      Relação
                    </span>

                    <Input
                      value={relationship.relation}
                      placeholder="Ex: Aliada"
                      onChange={(event) =>
                        updateRelationship(relationship.id, {
                          relation: event.target.value,
                        })
                      }
                    />
                  </label>

                  <button
                    type="button"
                    title="Remover relação"
                    aria-label="Remover relação"
                    onClick={() =>
                      removeRelationship(relationship.id)
                    }
                    className="mt-5 flex h-10 w-10 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-danger hover:bg-dangerBg hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-textH">
                    Descrição
                  </span>

                  <Textarea
                    className="min-h-24"
                    value={relationship.description ?? ""}
                    placeholder="Como essa pessoa se conecta ao personagem?"
                    onChange={(event) =>
                      updateRelationship(relationship.id, {
                        description: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-8 text-center text-xs text-textMuted">
            Nenhuma relação cadastrada.
          </div>
        )}
      </section>
    </div>
  )
}