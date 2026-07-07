import { useEffect, useState, type ReactNode } from "react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Textarea } from "../../components/ui/Textarea"
import type {
  InitiativeConditionDuration,
  InitiativeEntry,
  InitiativeSide,
  InitiativeSourceType,
} from "../../models/initiative/Initiative"

const CONDITION_SUGGESTIONS = [
  "Agarrado",
  "Amedrontado",
  "Atordoado",
  "Caído",
  "Cego",
  "Enfeitiçado",
  "Envenenado",
  "Impedido",
  "Incapacitado",
  "Inconsciente",
  "Invisível",
  "Paralisado",
  "Petrificado",
  "Surdo",
]

const selectClassName =
  "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export type CustomInitiativeEntryDraft = {
  name: string
  sourceType: InitiativeSourceType
  side: InitiativeSide
  quantity: number
  initiativeBonus: number
  armorClass?: number
  maxHp?: number
  sharedInitiative: boolean
}

export type InitiativeConditionInput = {
  name: string
  description?: string
  duration: InitiativeConditionDuration
}

type CustomEntryDialogProps = {
  onClose: () => void
  onAdd: (draft: CustomInitiativeEntryDraft) => void
}

const initialCustomDraft: CustomInitiativeEntryDraft = {
  name: "",
  sourceType: "monster",
  side: "enemy",
  quantity: 1,
  initiativeBonus: 0,
  sharedInitiative: false,
}

export function CustomEntryDialog({
  onClose,
  onAdd,
}: CustomEntryDialogProps) {
  const [draft, setDraft] = useState(initialCustomDraft)

  function submit() {
    if (!draft.name.trim()) return
    onAdd({
      ...draft,
      name: draft.name.trim(),
      quantity: clamp(Math.trunc(draft.quantity), 1, 50),
    })
  }

  return (
    <Modal title="Adicionar monstro, inimigo ou NPC" onClose={onClose}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" className="sm:col-span-2">
          <Input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Ex.: Goblin"
            autoFocus
          />
        </Field>

        <Field label="Tipo">
          <select
            className={selectClassName}
            value={draft.sourceType}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sourceType: event.target.value as InitiativeSourceType,
              }))
            }
          >
            <option value="monster">Monstro</option>
            <option value="npc">NPC</option>
            <option value="custom">Outro</option>
          </select>
        </Field>

        <Field label="Lado">
          <select
            className={selectClassName}
            value={draft.side}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                side: event.target.value as InitiativeSide,
              }))
            }
          >
            <option value="enemy">Inimigo</option>
            <option value="ally">Aliado</option>
            <option value="neutral">Neutro</option>
          </select>
        </Field>

        <Field label="Quantidade">
          <Input
            type="number"
            min={1}
            max={50}
            value={draft.quantity}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                quantity: Number(event.target.value),
              }))
            }
          />
        </Field>

        <Field label="Bônus de iniciativa">
          <Input
            type="number"
            value={draft.initiativeBonus}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                initiativeBonus: Number(event.target.value),
              }))
            }
          />
        </Field>

        <Field label="CA">
          <Input
            type="number"
            value={draft.armorClass ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                armorClass: optionalNumber(event.target.value),
              }))
            }
            placeholder="Opcional"
          />
        </Field>

        <Field label="PV máximos">
          <Input
            type="number"
            min={0}
            value={draft.maxHp ?? ""}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                maxHp: optionalNumber(event.target.value),
              }))
            }
            placeholder="Opcional"
          />
        </Field>

        <label className="flex items-center gap-3 rounded-lg border border-border bg-bg-subtle p-3 text-sm text-textH sm:col-span-2">
          <input
            type="checkbox"
            checked={draft.sharedInitiative}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sharedInitiative: event.target.checked,
              }))
            }
          />
          Usar a mesma rolagem para todas as cópias
        </label>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={!draft.name.trim()}
        >
          Adicionar e rolar
        </Button>
      </div>
    </Modal>
  )
}

type ConditionDialogProps = {
  targetName: string
  targetEntryId: string
  entries: InitiativeEntry[]
  activeEntryId?: string
  onClose: () => void
  onApply: (condition: InitiativeConditionInput) => void
}

type ConditionDraft = {
  name: string
  description: string
  durationType: InitiativeConditionDuration["type"]
  remaining: number
  ownerEntryId: string
}

export function ConditionDialog({
  targetName,
  targetEntryId,
  entries,
  activeEntryId,
  onClose,
  onApply,
}: ConditionDialogProps) {
  const [draft, setDraft] = useState<ConditionDraft>({
    name: "",
    description: "",
    durationType: "manual",
    remaining: 1,
    ownerEntryId: activeEntryId ?? targetEntryId,
  })

  useEffect(() => {
    setDraft((current) => ({
      ...current,
      ownerEntryId: activeEntryId ?? targetEntryId,
    }))
  }, [activeEntryId, targetEntryId])

  function submit() {
    if (!draft.name.trim()) return

    onApply({
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      duration: buildDuration(draft, targetEntryId),
    })
  }

  return (
    <Modal title={`Condição em ${targetName}`} onClose={onClose}>
      <div className="grid gap-4">
        <Field label="Condição">
          <Input
            list="initiative-condition-suggestions"
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                name: event.target.value,
              }))
            }
            placeholder="Ex.: Atordoado"
            autoFocus
          />
          <datalist id="initiative-condition-suggestions">
            {CONDITION_SUGGESTIONS.map((condition) => (
              <option key={condition} value={condition} />
            ))}
          </datalist>
        </Field>

        <Field label="Descrição">
          <Textarea
            className="min-h-20"
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Opcional"
          />
        </Field>

        <Field label="Duração">
          <select
            className={selectClassName}
            value={draft.durationType}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                durationType: event.target
                  .value as InitiativeConditionDuration["type"],
              }))
            }
          >
            <option value="manual">Remoção manual</option>
            <option value="turns">Turnos do afetado</option>
            <option value="rounds">Rodadas completas</option>
            <option value="untilTurnStart">Até o início de um turno</option>
            <option value="untilTurnEnd">Até o fim de um turno</option>
          </select>
        </Field>

        {draft.durationType === "turns" ||
        draft.durationType === "rounds" ? (
          <Field label="Quantidade">
            <Input
              type="number"
              min={1}
              value={draft.remaining}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  remaining: Number(event.target.value),
                }))
              }
            />
          </Field>
        ) : null}

        {draft.durationType === "untilTurnStart" ||
        draft.durationType === "untilTurnEnd" ? (
          <Field label="Turno de referência">
            <select
              className={selectClassName}
              value={draft.ownerEntryId}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ownerEntryId: event.target.value,
                }))
              }
            >
              {entries.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="primary"
          onClick={submit}
          disabled={!draft.name.trim()}
        >
          Aplicar condição
        </Button>
      </div>
    </Modal>
  )
}

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={`grid gap-1.5 text-sm text-textH ${className ?? ""}`}>
      <span className="font-medium">{label}</span>
      {children}
    </label>
  )
}

function buildDuration(
  draft: ConditionDraft,
  targetEntryId: string,
): InitiativeConditionDuration {
  switch (draft.durationType) {
    case "turns":
      return { type: "turns", remaining: Math.max(1, draft.remaining) }
    case "rounds":
      return { type: "rounds", remaining: Math.max(1, draft.remaining) }
    case "untilTurnStart":
      return {
        type: "untilTurnStart",
        ownerEntryId: draft.ownerEntryId || targetEntryId,
      }
    case "untilTurnEnd":
      return {
        type: "untilTurnEnd",
        ownerEntryId: draft.ownerEntryId || targetEntryId,
      }
    default:
      return { type: "manual" }
  }
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}
