import { useState } from "react"
import { Plus, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { attributeShort } from "../../../lib/attributeShorts"
import type {
  Ability,
  AbilityActionKind,
  AbilityKind,
} from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Proficiency, ProficiencyCategory } from "../../../models/sheet/Proficiency"
import type { Attribute } from "../../../models/sheet/Attribute"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import type { CharacterRace, CreatureSize } from "../../../models/races/CharacterRace"
import type { Race } from "../../../models/races/Race"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type ManagedProficiencyCategory = Exclude<
  ProficiencyCategory,
  "skill" | "saving-throw"
>

const RACE_OPTIONS: Array<{ value: Race; label: string }> = [
  { value: "aarakocra", label: "Aarakocra" },
  { value: "aasimar", label: "Aasimar" },
  { value: "bugbear", label: "Bugbear" },
  { value: "centaur", label: "Centauro" },
  { value: "changeling", label: "Changeling" },
  { value: "dragonborn", label: "Draconato" },
  { value: "dwarf", label: "Anão" },
  { value: "duergar", label: "Duergar" },
  { value: "elf", label: "Elfo" },
  { value: "eladrin", label: "Eladrin" },
  { value: "fairy", label: "Fada" },
  { value: "firbolg", label: "Firbolg" },
  { value: "genasi", label: "Genasi" },
  { value: "giff", label: "Giff" },
  { value: "githyanki", label: "Githyanki" },
  { value: "githzerai", label: "Githzerai" },
  { value: "gnome", label: "Gnomo" },
  { value: "deep-gnome", label: "Gnomo das Profundezas" },
  { value: "goblin", label: "Goblin" },
  { value: "goliath", label: "Golias" },
  { value: "half-elf", label: "Meio-elfo" },
  { value: "half-orc", label: "Meio-orc" },
  { value: "halfling", label: "Halfling" },
  { value: "harengon", label: "Harengon" },
  { value: "hobgoblin", label: "Hobgoblin" },
  { value: "human", label: "Humano" },
  { value: "kenku", label: "Kenku" },
  { value: "kobold", label: "Kobold" },
  { value: "leonin", label: "Leonin" },
  { value: "lizardfolk", label: "Povo-lagarto" },
  { value: "loxodon", label: "Loxodon" },
  { value: "minotaur", label: "Minotauro" },
  { value: "orc", label: "Orc" },
  { value: "owlin", label: "Owlin" },
  { value: "satyr", label: "Sátiro" },
  { value: "shadar-kai", label: "Shadar-kai" },
  { value: "shifter", label: "Shifter" },
  { value: "tabaxi", label: "Tabaxi" },
  { value: "thri-kreen", label: "Thri-kreen" },
  { value: "tiefling", label: "Tiefling" },
  { value: "tortle", label: "Tortle" },
  { value: "triton", label: "Tritão" },
  { value: "vedalken", label: "Vedalken" },
  { value: "verdan", label: "Verdan" },
  { value: "warforged", label: "Forjado Bélico" },
  { value: "yuan-ti", label: "Yuan-ti" },
]

const SIZE_OPTIONS: Array<{ value: CreatureSize; label: string }> = [
  { value: "tiny", label: "Minúsculo" },
  { value: "small", label: "Pequeno" },
  { value: "medium", label: "Médio" },
  { value: "large", label: "Grande" },
  { value: "huge", label: "Enorme" },
  { value: "gargantuan", label: "Colossal" },
]

const PROFICIENCY_CATEGORIES: Array<{
  value: ManagedProficiencyCategory
  label: string
}> = [
  { value: "weapon", label: "Arma" },
  { value: "armor", label: "Armadura" },
  { value: "shield", label: "Escudo" },
  { value: "tool", label: "Ferramenta" },
  { value: "vehicle", label: "Veículo" },
  { value: "mount", label: "Montaria" },
  { value: "language", label: "Idioma" },
  { value: "instrument", label: "Instrumento" },
  { value: "game", label: "Jogo" },
  { value: "other", label: "Outro" },
]

const ABILITY_ACTIONS: Array<{
  value: AbilityActionKind
  label: string
}> = [
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
  { value: "free", label: "Livre" },
]

export function CharacterRaceTab({
  character,
  updateCharacter,
}: Props) {
  const [abilityModalOpen, setAbilityModalOpen] = useState(false)
  const [proficiencyModalOpen, setProficiencyModalOpen] = useState(false)

  const race = character.get("sheet").race

  function updateRace(
    updater: (race: CharacterRace) => CharacterRace,
  ) {
    updateCharacter(character.get("id"), (current) =>
      current.withSheet("race", updater(current.get("sheet").race)),
    )
  }

  function setRaceField<K extends keyof CharacterRace>(
    key: K,
    value: CharacterRace[K],
  ) {
    updateRace((currentRace) => ({
      ...currentRace,
      [key]: value,
    }))
  }

  function setAttributeBonus(
    attribute: Attribute,
    value: number,
  ) {
    updateRace((currentRace) => ({
      ...currentRace,
      attributeBonus: {
        ...(currentRace.attributeBonus ?? {}),
        [attribute]: value,
      },
    }))
  }

  function addAbility(ability: Ability) {
    updateRace((currentRace) => ({
      ...currentRace,
      naturalAbilities: [
        ...(currentRace.naturalAbilities ?? []),
        ability,
      ],
    }))
  }

  function removeAbility(abilityId: string) {
    updateRace((currentRace) => ({
      ...currentRace,
      naturalAbilities: (
        currentRace.naturalAbilities ?? []
      ).filter((ability) => ability.id !== abilityId),
    }))
  }

  function addProficiency(proficiency: Proficiency) {
    updateRace((currentRace) => ({
      ...currentRace,
      proficiencies: [
        ...(currentRace.proficiencies ?? []),
        proficiency,
      ],
    }))
  }

  function removeProficiency(proficiencyId: string) {
    updateRace((currentRace) => ({
      ...currentRace,
      proficiencies: (
        currentRace.proficiencies ?? []
      ).filter(
        (proficiency) =>
          proficiency.id !== proficiencyId,
      ),
    }))
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-textH">
            Raça
          </h2>

          <p className="mt-1 text-xs text-textMuted">
            Configure identidade racial, tamanho, deslocamento,
            bônus raciais, habilidades naturais e proficiências.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Raça
            </span>

            <Select
              value={race.race}
              onChange={(event) =>
                setRaceField("race", event.target.value as Race)
              }
            >
              {RACE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Sub-raça
            </span>

            <Input
              value={race.subrace ?? ""}
              placeholder="Ex: Alto Elfo"
              onChange={(event) =>
                setRaceField("subrace", event.target.value)
              }
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Tamanho
            </span>

            <Select
              value={race.size ?? "medium"}
              onChange={(event) =>
                setRaceField(
                  "size",
                  event.target.value as CreatureSize,
                )
              }
            >
              {SIZE_OPTIONS.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Bônus de deslocamento
            </span>

            <Input
              type="number"
              value={race.speedBonus ?? 0}
              onChange={(event) =>
                setRaceField(
                  "speedBonus",
                  Number(event.target.value) || 0,
                )
              }
            />
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-textH">
            Bônus de atributo
          </h2>

          <p className="mt-1 text-xs text-textMuted">
            Esses valores são somados aos atributos base do personagem.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {ATTRIBUTE_KEYS.map((attribute) => (
            <label
              key={attribute}
              className="grid gap-1.5 rounded-lg border border-border bg-bg-subtle p-3"
            >
              <span className="text-center text-xs font-bold uppercase tracking-wide text-textH">
                {attributeShort(attribute)}
              </span>

              <Input
                type="number"
                className="text-center"
                value={race.attributeBonus?.[attribute] ?? 0}
                onChange={(event) =>
                  setAttributeBonus(
                    attribute,
                    Number(event.target.value) || 0,
                  )
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">
              Habilidades naturais
            </h2>

            <p className="mt-1 text-xs text-textMuted">
              Traços raciais como visão no escuro, ancestralidade feérica,
              sopro dracônico, resistência infernal etc.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setAbilityModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Habilidade
          </Button>
        </div>

        {(race.naturalAbilities ?? []).length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {(race.naturalAbilities ?? []).map((ability) => (
              <div
                key={ability.id}
                className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {ability.name}
                    </div>

                    <div className="mt-1 text-xs text-textMuted">
                      {formatAbilityMeta(ability)}
                    </div>
                  </div>

                  <button
                    type="button"
                    title="Remover habilidade"
                    aria-label={`Remover ${ability.name}`}
                    onClick={() => removeAbility(ability.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-danger hover:bg-dangerBg hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {ability.description ? (
                  <p className="text-xs leading-relaxed text-text">
                    {ability.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <EmptyCard text="Nenhuma habilidade natural cadastrada." />
        )}
      </section>

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-textH">
              Proficiências raciais
            </h2>

            <p className="mt-1 text-xs text-textMuted">
              Idiomas, armas, ferramentas ou outros treinamentos recebidos pela raça.
            </p>
          </div>

          <Button
            size="sm"
            variant="primary"
            onClick={() => setProficiencyModalOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Proficiência
          </Button>
        </div>

        {(race.proficiencies ?? []).length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {(race.proficiencies ?? []).map((proficiency) => (
              <div
                key={proficiency.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-textH">
                    {proficiency.name}
                  </div>

                  <div className="mt-0.5 text-xs text-textMuted">
                    {formatProficiencyCategory(proficiency.category)}
                  </div>

                  {proficiency.notes ? (
                    <p className="mt-1 text-xs text-text">
                      {proficiency.notes}
                    </p>
                  ) : null}
                </div>

                <button
                  type="button"
                  title="Remover proficiência"
                  aria-label={`Remover ${proficiency.name}`}
                  onClick={() => removeProficiency(proficiency.id)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-danger hover:bg-dangerBg hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyCard text="Nenhuma proficiência racial cadastrada." />
        )}
      </section>

      <AddRaceAbilityModal
        open={abilityModalOpen}
        onClose={() => setAbilityModalOpen(false)}
        onSave={(ability) => {
          addAbility(ability)
          setAbilityModalOpen(false)
        }}
      />

      <AddRaceProficiencyModal
        open={proficiencyModalOpen}
        onClose={() => setProficiencyModalOpen(false)}
        onSave={(proficiency) => {
          addProficiency(proficiency)
          setProficiencyModalOpen(false)
        }}
      />
    </div>
  )
}

function AddRaceAbilityModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (ability: Ability) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [kind, setKind] = useState<AbilityKind>("passive")
  const [actionKind, setActionKind] =
    useState<AbilityActionKind>("action")
  const [error, setError] = useState("")

  if (!open) return null

  function reset() {
    setName("")
    setDescription("")
    setKind("passive")
    setActionKind("action")
    setError("")
  }

  function close() {
    reset()
    onClose()
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("Informe o nome da habilidade.")
      return
    }

    onSave({
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description.trim() || undefined,
      kind,
      actionKind: kind === "active" ? actionKind : undefined,
    })

    reset()
  }

  return (
    <ModalShell
      title="Adicionar habilidade racial"
      description="Cadastre uma habilidade natural concedida pela raça."
      onClose={close}
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Nome
          </span>

          <Input
            value={name}
            invalid={Boolean(error)}
            placeholder="Ex: Visão no Escuro"
            onChange={(event) => {
              setName(event.target.value)
              setError("")
            }}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Tipo
          </span>

          <Select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as AbilityKind)
            }
          >
            <option value="passive">Passiva</option>
            <option value="active">Ativa</option>
          </Select>
        </label>

        {kind === "active" ? (
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">
              Ação usada
            </span>

            <Select
              value={actionKind}
              onChange={(event) =>
                setActionKind(
                  event.target.value as AbilityActionKind,
                )
              }
            >
              {ABILITY_ACTIONS.map((action) => (
                <option
                  key={action.value}
                  value={action.value}
                >
                  {action.label}
                </option>
              ))}
            </Select>
          </label>
        ) : null}

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Descrição
          </span>

          <Textarea
            value={description}
            placeholder="Descreva o efeito da habilidade..."
            onChange={(event) =>
              setDescription(event.target.value)
            }
          />
        </label>

        {error ? (
          <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <ModalActions
        onCancel={close}
        onConfirm={save}
        confirmLabel="Adicionar"
      />
    </ModalShell>
  )
}

function AddRaceProficiencyModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (proficiency: Proficiency) => void
}) {
  const [category, setCategory] =
    useState<ManagedProficiencyCategory>("language")
  const [name, setName] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState("")

  if (!open) return null

  function reset() {
    setCategory("language")
    setName("")
    setNotes("")
    setError("")
  }

  function close() {
    reset()
    onClose()
  }

  function save() {
    const trimmedName = name.trim()

    if (!trimmedName) {
      setError("Informe o nome da proficiência.")
      return
    }

    onSave({
      id: crypto.randomUUID(),
      category,
      name: trimmedName,
      notes: notes.trim() || undefined,
    })

    reset()
  }

  return (
    <ModalShell
      title="Adicionar proficiência racial"
      description="Cadastre um idioma, ferramenta, arma ou treinamento racial."
      onClose={close}
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Categoria
          </span>

          <Select
            value={category}
            onChange={(event) =>
              setCategory(
                event.target.value as ManagedProficiencyCategory,
              )
            }
          >
            {PROFICIENCY_CATEGORIES.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </Select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Nome
          </span>

          <Input
            value={name}
            invalid={Boolean(error)}
            placeholder="Ex: Comum, Élfico, Espadas Longas..."
            onChange={(event) => {
              setName(event.target.value)
              setError("")
            }}
          />
        </label>

        <label className="grid gap-1.5">
          <span className="text-xs font-medium text-textH">
            Observações
          </span>

          <Textarea
            value={notes}
            placeholder="Opcional."
            onChange={(event) =>
              setNotes(event.target.value)
            }
          />
        </label>

        {error ? (
          <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <ModalActions
        onCancel={close}
        onConfirm={save}
        confirmLabel="Adicionar"
      />
    </ModalShell>
  )
}

function ModalShell({
  title,
  description,
  children,
  onClose,
}: {
  title: string
  description: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg rounded-xl border border-border bg-bg-elevated p-4 text-text shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-base font-semibold text-textH">
              {title}
            </h2>

            <p className="mt-1 text-xs text-textMuted">
              {description}
            </p>
          </div>

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-textMuted transition-colors hover:border-border hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

function ModalActions({
  onCancel,
  onConfirm,
  confirmLabel,
}: {
  onCancel: () => void
  onConfirm: () => void
  confirmLabel: string
}) {
  return (
    <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
      <Button
        size="sm"
        variant="secondary"
        onClick={onCancel}
      >
        Cancelar
      </Button>

      <Button
        size="sm"
        variant="primary"
        onClick={onConfirm}
      >
        <Plus className="h-4 w-4" />
        {confirmLabel}
      </Button>
    </div>
  )
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-xs text-textMuted">
      {text}
    </div>
  )
}

function formatAbilityMeta(ability: Ability): string {
  const kind = ability.kind === "active" ? "Ativa" : "Passiva"

  if (ability.kind !== "active") return kind

  return `${kind} • ${formatActionKind(ability.actionKind)}`
}

function formatActionKind(actionKind?: AbilityActionKind): string {
  if (actionKind === "action") return "Ação"
  if (actionKind === "bonusAction") return "Ação bônus"
  if (actionKind === "reaction") return "Reação"
  if (actionKind === "free") return "Livre"

  return "Ação"
}

function formatProficiencyCategory(
  category: ProficiencyCategory,
): string {
  if (category === "weapon") return "Arma"
  if (category === "armor") return "Armadura"
  if (category === "shield") return "Escudo"
  if (category === "tool") return "Ferramenta"
  if (category === "vehicle") return "Veículo"
  if (category === "mount") return "Montaria"
  if (category === "language") return "Idioma"
  if (category === "instrument") return "Instrumento"
  if (category === "game") return "Jogo"
  if (category === "skill") return "Perícia"
  if (category === "saving-throw") return "Teste de resistência"

  return "Outro"
}