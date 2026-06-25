import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  Grid2X2,
  List,
  Play,
  RotateCcw,
  Shield,
  Skull,
  Swords,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { Button } from "../components/ui/Button"
import { useCharacterContext } from "../contexts/characterContext"
import { useSyncContext } from "../contexts/syncContext"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import {
  addInitiativeEntries,
  advanceInitiativeTurn,
  applyInitiativeCondition,
  canTradeConsecutiveAllies,
  endInitiativeCombat,
  removeInitiativeCondition,
  removeInitiativeEntry,
  rewindInitiativeTurn,
  rollInitiative,
  sortInitiativeEntries,
  startInitiativeCombat,
  tradeConsecutiveAllies,
  updateInitiativeEntry,
  type InitiativeConditionDuration,
  type InitiativeEntry,
  type InitiativeSide,
  type InitiativeSourceType,
} from "../models/initiative/Initiative"

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

const inputClassName = [
  "h-10 w-full rounded-lg border border-border bg-bg px-3",
  "text-sm text-textH outline-none transition-colors",
  "focus:border-accent focus:ring-2 focus:ring-accent/20",
].join(" ")

const compactInputClassName = [
  "h-8 rounded-md border border-border bg-bg px-2",
  "text-sm text-textH outline-none",
  "focus:border-accent focus:ring-2 focus:ring-accent/20",
].join(" ")

type CustomEntryDraft = {
  name: string
  sourceType: InitiativeSourceType
  side: InitiativeSide
  quantity: number
  initiativeBonus: number
  armorClass: string
  maxHp: string
  sharedInitiative: boolean
}

type ConditionDraft = {
  name: string
  description: string
  durationType: InitiativeConditionDuration["type"]
  remaining: number
  ownerEntryId: string
}

const initialCustomEntryDraft: CustomEntryDraft = {
  name: "",
  sourceType: "monster",
  side: "enemy",
  quantity: 1,
  initiativeBonus: 0,
  armorClass: "",
  maxHp: "",
  sharedInitiative: false,
}

const initialConditionDraft: ConditionDraft = {
  name: "",
  description: "",
  durationType: "manual",
  remaining: 1,
  ownerEntryId: "",
}

export function InitiativeView() {
  const { visibleCharacters } = useCharacterContext()
  const { userRole } = useSyncContext()
  const { session, updateSession, resetSession, hydrated } =
    useInitiativeSession()

  const [selectedCharacterId, setSelectedCharacterId] = useState("")
  const [selectedCharacterSide, setSelectedCharacterSide] =
    useState<InitiativeSide>("ally")
  const [customOpen, setCustomOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState<CustomEntryDraft>(
    initialCustomEntryDraft,
  )
  const [conditionTargetId, setConditionTargetId] = useState<string>()
  const [conditionDraft, setConditionDraft] = useState<ConditionDraft>(
    initialConditionDraft,
  )
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const selectedCharacter = useMemo(
    () =>
      visibleCharacters.find(
        (character) => character.get("id") === selectedCharacterId,
      ),
    [selectedCharacterId, visibleCharacters],
  )

  const activeEntry = session.entries.find(
    (entry) => entry.id === session.activeEntryId,
  )
  const conditionTarget = session.entries.find(
    (entry) => entry.id === conditionTargetId,
  )

  useEffect(() => {
    if (!session.activeEntryId || session.viewMode !== "cards") return

    cardRefs.current.get(session.activeEntryId)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    })
  }, [session.activeEntryId, session.viewMode])

  useEffect(() => {
    if (!selectedCharacter) return
    setSelectedCharacterSide(
      defaultSideForCharacter(selectedCharacter.get("sheet").type),
    )
  }, [selectedCharacter])

  function patchEntry(entryId: string, patch: Partial<InitiativeEntry>) {
    updateSession((current) =>
      updateInitiativeEntry(current, entryId, (entry) => ({
        ...entry,
        ...patch,
      })),
    )
  }

  function addSelectedCharacter() {
    if (!selectedCharacter) return

    const sourceId = selectedCharacter.get("id")
    const alreadyAdded = session.entries.filter(
      (entry) => entry.sourceId === sourceId,
    ).length

    if (selectedCharacter.get("unique") && alreadyAdded > 0) return

    const initiativeBonus = selectedCharacter.getEffectiveInitiative()
    const baseName = selectedCharacter.get("name")
    const name = selectedCharacter.get("unique")
      ? baseName
      : `${baseName} ${alreadyAdded + 1}`
    const sheet = selectedCharacter.get("sheet")

    updateSession((current) =>
      addInitiativeEntries(current, [
        {
          sourceId,
          sourceType:
            sheet.type === "pc"
              ? "character"
              : sheet.type === "npc"
                ? "npc"
                : "monster",
          name,
          imageUrl: selectedCharacter.get("profile").imageUrl,
          initiative: rollInitiative(initiativeBonus),
          initiativeBonus,
          dexterity: selectedCharacter.getEffectiveAttribute("dex"),
          side: selectedCharacterSide,
          armorClass: selectedCharacter.getEffectiveArmorClass(),
          currentHp: sheet.HP.current,
          maxHp: selectedCharacter.getEffectiveMaxHp(),
          temporaryHp: selectedCharacter.getEffectiveTemporaryHp(),
        },
      ]),
    )
  }

  function addCustomEntries() {
    const name = customDraft.name.trim()
    if (!name) return

    const quantity = clamp(Math.trunc(customDraft.quantity), 1, 50)
    const existingCopies = session.entries.filter(
      (entry) => entry.name === name || entry.name.startsWith(`${name} `),
    ).length
    const sharedRoll = customDraft.sharedInitiative
      ? rollInitiative(customDraft.initiativeBonus)
      : undefined
    const maxHp = optionalNumber(customDraft.maxHp)

    const entries = Array.from({ length: quantity }, (_, index) => ({
      sourceType: customDraft.sourceType,
      name:
        quantity === 1 && existingCopies === 0
          ? name
          : `${name} ${existingCopies + index + 1}`,
      initiative: sharedRoll ?? rollInitiative(customDraft.initiativeBonus),
      initiativeBonus: customDraft.initiativeBonus,
      side: customDraft.side,
      armorClass: optionalNumber(customDraft.armorClass),
      currentHp: maxHp,
      maxHp,
      temporaryHp: 0,
    }))

    updateSession((current) => addInitiativeEntries(current, entries))
    setCustomDraft(initialCustomEntryDraft)
    setCustomOpen(false)
  }

  function openConditionDialog(entryId: string) {
    setConditionTargetId(entryId)
    setConditionDraft({
      ...initialConditionDraft,
      ownerEntryId: session.activeEntryId ?? entryId,
    })
  }

  function addCondition() {
    if (!conditionTargetId || !conditionDraft.name.trim()) return

    const duration = buildConditionDuration(conditionDraft, conditionTargetId)

    updateSession((current) =>
      applyInitiativeCondition(current, conditionTargetId, {
        name: conditionDraft.name.trim(),
        description: conditionDraft.description.trim() || undefined,
        duration,
      }),
    )
    setConditionTargetId(undefined)
    setConditionDraft(initialConditionDraft)
  }

  async function clearCombat() {
    if (!window.confirm("Apagar todo o combate salvo localmente?")) return
    await resetSession()
  }

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text">
        Carregando iniciativa local…
      </div>
    )
  }

  if (userRole !== "master") {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-bg p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-heading text-lg font-semibold text-textH">
              Iniciativa do mestre
            </h1>
            <p className="mt-1 text-sm text-text">
              Este modo é local e só pode ser controlado com o perfil de mestre.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-xl font-semibold text-textH">
                Iniciativa
              </h1>
              <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-xs font-medium text-textMuted">
                Apenas neste dispositivo
              </span>
              <span className="rounded-full border border-accentBorder bg-accentBg px-2.5 py-1 text-xs font-semibold text-accent">
                Rodada {session.round}
              </span>
            </div>
            <p className="mt-1 text-sm text-text">
              {activeEntry
                ? `Turno atual: ${activeEntry.name}`
                : "Adicione os participantes e inicie o combate."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={session.viewMode === "table" ? "primary" : "secondary"}
              size="sm"
              onClick={() =>
                updateSession((current) => ({
                  ...current,
                  viewMode: "table",
                  updatedAt: Date.now(),
                }))
              }
            >
              <List className="h-4 w-4" />
              Tabela
            </Button>
            <Button
              variant={session.viewMode === "cards" ? "primary" : "secondary"}
              size="sm"
              onClick={() =>
                updateSession((current) => ({
                  ...current,
                  viewMode: "cards",
                  updatedAt: Date.now(),
                }))
              }
            >
              <Grid2X2 className="h-4 w-4" />
              Cartões
            </Button>
            <Button variant="ghost" size="sm" onClick={clearCombat}>
              <RotateCcw className="h-4 w-4" />
              Limpar
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-textH">
            <UserPlus className="h-4 w-4 text-accent" />
            Adicionar ficha existente
          </div>

          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <select
              className={inputClassName}
              value={selectedCharacterId}
              onChange={(event) => setSelectedCharacterId(event.target.value)}
              disabled={session.started}
            >
              <option value="">Selecione uma ficha</option>
              {visibleCharacters.map((character) => {
                const alreadyAdded = session.entries.some(
                  (entry) => entry.sourceId === character.get("id"),
                )
                const disabled = character.get("unique") && alreadyAdded

                return (
                  <option
                    key={character.get("id")}
                    value={character.get("id")}
                    disabled={disabled}
                  >
                    {character.get("name")}
                    {disabled ? " — já adicionado" : ""}
                  </option>
                )
              })}
            </select>

            <select
              className={inputClassName}
              value={selectedCharacterSide}
              onChange={(event) =>
                setSelectedCharacterSide(event.target.value as InitiativeSide)
              }
              disabled={session.started}
            >
              <option value="ally">Aliado</option>
              <option value="enemy">Inimigo</option>
              <option value="neutral">Neutro</option>
            </select>

            <Button
              variant="primary"
              onClick={addSelectedCharacter}
              disabled={!selectedCharacter || session.started}
            >
              <CirclePlus className="h-4 w-4" />
              Adicionar e rolar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-stretch gap-2 rounded-xl border border-border bg-bg p-4 shadow-theme-sm xl:flex-nowrap">
          <Button
            onClick={() => setCustomOpen(true)}
            disabled={session.started}
          >
            <Swords className="h-4 w-4" />
            Monstro ou NPC
          </Button>
          <Button
            onClick={() => updateSession(sortInitiativeEntries)}
            disabled={session.started || session.entries.length < 2}
          >
            Ordenar
          </Button>
          {session.started ? (
            <Button
              variant="danger"
              onClick={() => updateSession(endInitiativeCombat)}
            >
              Encerrar
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => updateSession(startInitiativeCombat)}
              disabled={session.entries.length === 0}
            >
              <Play className="h-4 w-4" />
              Iniciar
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">
              {session.entries.length} participante
              {session.entries.length === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-textMuted">
              Aliados consecutivos podem trocar de posição.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              title="Turno anterior"
              onClick={() => updateSession(rewindInitiativeTurn)}
              disabled={!session.started}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="primary"
              onClick={() => updateSession(advanceInitiativeTurn)}
              disabled={!session.started}
            >
              Próximo turno
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {session.entries.length === 0 ? (
          <div className="p-10 text-center">
            <Swords className="mx-auto h-10 w-10 text-textMuted" />
            <div className="mt-3 text-sm font-semibold text-textH">
              Nenhum participante
            </div>
            <div className="mt-1 text-sm text-text">
              Adicione fichas existentes ou crie entradas rápidas para o combate.
            </div>
          </div>
        ) : session.viewMode === "table" ? (
          <InitiativeTable
            entries={session.entries}
            activeEntryId={session.activeEntryId}
            roundAnchorEntryId={session.roundAnchorEntryId}
            round={session.round}
            started={session.started}
            patchEntry={patchEntry}
            onCondition={openConditionDialog}
            onRemove={(entryId) =>
              updateSession((current) =>
                removeInitiativeEntry(current, entryId),
              )
            }
            onTrade={(entryId, direction) =>
              updateSession((current) =>
                tradeConsecutiveAllies(current, entryId, direction),
              )
            }
            canTrade={(entryId, direction) =>
              canTradeConsecutiveAllies(session, entryId, direction)
            }
            onRemoveCondition={(entryId, conditionId) =>
              updateSession((current) =>
                removeInitiativeCondition(current, entryId, conditionId),
              )
            }
          />
        ) : (
          <InitiativeCards
            entries={session.entries}
            activeEntryId={session.activeEntryId}
            roundAnchorEntryId={session.roundAnchorEntryId}
            round={session.round}
            started={session.started}
            cardRefs={cardRefs}
            patchEntry={patchEntry}
            onCondition={openConditionDialog}
            onRemove={(entryId) =>
              updateSession((current) =>
                removeInitiativeEntry(current, entryId),
              )
            }
            onTrade={(entryId, direction) =>
              updateSession((current) =>
                tradeConsecutiveAllies(current, entryId, direction),
              )
            }
            canTrade={(entryId, direction) =>
              canTradeConsecutiveAllies(session, entryId, direction)
            }
            onRemoveCondition={(entryId, conditionId) =>
              updateSession((current) =>
                removeInitiativeCondition(current, entryId, conditionId),
              )
            }
          />
        )}
      </section>

      {customOpen && (
        <Modal
          title="Adicionar monstro, inimigo ou NPC"
          onClose={() => setCustomOpen(false)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" className="sm:col-span-2">
              <input
                className={inputClassName}
                value={customDraft.name}
                onChange={(event) =>
                  setCustomDraft((current) => ({
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
                className={inputClassName}
                value={customDraft.sourceType}
                onChange={(event) =>
                  setCustomDraft((current) => ({
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
                className={inputClassName}
                value={customDraft.side}
                onChange={(event) =>
                  setCustomDraft((current) => ({
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
              <input
                type="number"
                min={1}
                max={50}
                className={inputClassName}
                value={customDraft.quantity}
                onChange={(event) =>
                  setCustomDraft((current) => ({
                    ...current,
                    quantity: Number(event.target.value),
                  }))
                }
              />
            </Field>

            <Field label="Bônus de iniciativa">
              <input
                type="number"
                className={inputClassName}
                value={customDraft.initiativeBonus}
                onChange={(event) =>
                  setCustomDraft((current) => ({
                    ...current,
                    initiativeBonus: Number(event.target.value),
                  }))
                }
              />
            </Field>

            <Field label="CA">
              <input
                type="number"
                className={inputClassName}
                value={customDraft.armorClass}
                onChange={(event) =>
                  setCustomDraft((current) => ({
                    ...current,
                    armorClass: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </Field>

            <Field label="PV máximos">
              <input
                type="number"
                min={0}
                className={inputClassName}
                value={customDraft.maxHp}
                onChange={(event) =>
                  setCustomDraft((current) => ({
                    ...current,
                    maxHp: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </Field>

            <label className="flex items-center gap-3 rounded-lg border border-border bg-bg-subtle p-3 text-sm text-textH sm:col-span-2">
              <input
                type="checkbox"
                checked={customDraft.sharedInitiative}
                onChange={(event) =>
                  setCustomDraft((current) => ({
                    ...current,
                    sharedInitiative: event.target.checked,
                  }))
                }
              />
              Usar a mesma rolagem para todas as cópias
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setCustomOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={addCustomEntries}
              disabled={!customDraft.name.trim()}
            >
              Adicionar e rolar
            </Button>
          </div>
        </Modal>
      )}

      {conditionTarget && (
        <Modal
          title={`Condição em ${conditionTarget.name}`}
          onClose={() => setConditionTargetId(undefined)}
        >
          <div className="grid gap-4">
            <Field label="Condição">
              <input
                className={inputClassName}
                list="initiative-condition-suggestions"
                value={conditionDraft.name}
                onChange={(event) =>
                  setConditionDraft((current) => ({
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
              <textarea
                className={`${inputClassName} min-h-20 py-2`}
                value={conditionDraft.description}
                onChange={(event) =>
                  setConditionDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Opcional"
              />
            </Field>

            <Field label="Duração">
              <select
                className={inputClassName}
                value={conditionDraft.durationType}
                onChange={(event) =>
                  setConditionDraft((current) => ({
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

            {(conditionDraft.durationType === "turns" ||
              conditionDraft.durationType === "rounds") && (
              <Field label="Quantidade">
                <input
                  type="number"
                  min={1}
                  className={inputClassName}
                  value={conditionDraft.remaining}
                  onChange={(event) =>
                    setConditionDraft((current) => ({
                      ...current,
                      remaining: Number(event.target.value),
                    }))
                  }
                />
              </Field>
            )}

            {(conditionDraft.durationType === "untilTurnStart" ||
              conditionDraft.durationType === "untilTurnEnd") && (
              <Field label="Turno de referência">
                <select
                  className={inputClassName}
                  value={conditionDraft.ownerEntryId}
                  onChange={(event) =>
                    setConditionDraft((current) => ({
                      ...current,
                      ownerEntryId: event.target.value,
                    }))
                  }
                >
                  {session.entries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button onClick={() => setConditionTargetId(undefined)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={addCondition}
              disabled={!conditionDraft.name.trim()}
            >
              Aplicar condição
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

type InitiativeListProps = {
  entries: InitiativeEntry[]
  activeEntryId?: string
  roundAnchorEntryId?: string
  round: number
  started: boolean
  patchEntry: (entryId: string, patch: Partial<InitiativeEntry>) => void
  onCondition: (entryId: string) => void
  onRemove: (entryId: string) => void
  onTrade: (entryId: string, direction: -1 | 1) => void
  canTrade: (entryId: string, direction: -1 | 1) => boolean
  onRemoveCondition: (entryId: string, conditionId: string) => void
}

function InitiativeTable(props: InitiativeListProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-sm">
        <thead className="bg-bg-subtle text-xs uppercase tracking-wide text-textMuted">
          <tr>
            <th className="px-3 py-3">Turno</th>
            <th className="px-3 py-3">Iniciativa</th>
            <th className="px-3 py-3">Participante</th>
            <th className="px-3 py-3">PV</th>
            <th className="px-3 py-3">CA</th>
            <th className="px-3 py-3">Condições</th>
            <th className="px-3 py-3">Troca</th>
            <th className="px-3 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {props.entries.map((entry) => (
            <TableEntryRows key={entry.id} entry={entry} {...props} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TableEntryRows({
  entry,
  activeEntryId,
  roundAnchorEntryId,
  round,
  started,
  patchEntry,
  onCondition,
  onRemove,
  onTrade,
  canTrade,
  onRemoveCondition,
}: InitiativeListProps & { entry: InitiativeEntry }) {
  const active = entry.id === activeEntryId

  return (
    <>
      {started && entry.id === roundAnchorEntryId && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="flex items-center gap-3 border-t-2 border-danger px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-danger">
              <span>Início da rodada {round}</span>
              <span className="h-px flex-1 bg-danger" />
            </div>
          </td>
        </tr>
      )}
      <tr
        className={[
          "border-t border-border transition-colors",
          active ? "bg-accentBg" : "hover:bg-bg-subtle",
          entry.defeated ? "opacity-55" : "",
        ].join(" ")}
      >
        <td className="px-3 py-3">
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-semibold text-white">
              <Play className="h-3 w-3" /> Atual
            </span>
          ) : (
            <span className="text-textMuted">{entry.order + 1}</span>
          )}
        </td>
        <td className="px-3 py-3">
          <input
            type="number"
            className={`${compactInputClassName} w-20 text-center font-semibold`}
            value={entry.initiative}
            disabled={started}
            onChange={(event) =>
              patchEntry(entry.id, { initiative: Number(event.target.value) })
            }
          />
        </td>
        <td className="px-3 py-3">
          <EntryIdentity entry={entry} />
        </td>
        <td className="px-3 py-3">
          <HitPointEditor entry={entry} patchEntry={patchEntry} />
        </td>
        <td className="px-3 py-3">
          <input
            type="number"
            className={`${compactInputClassName} w-16 text-center`}
            value={entry.armorClass ?? ""}
            onChange={(event) =>
              patchEntry(entry.id, {
                armorClass: optionalNumber(event.target.value),
              })
            }
          />
        </td>
        <td className="max-w-sm px-3 py-3">
          <ConditionChips
            entry={entry}
            onAdd={() => onCondition(entry.id)}
            onRemove={(conditionId) =>
              onRemoveCondition(entry.id, conditionId)
            }
          />
        </td>
        <td className="px-3 py-3">
          <TradeControls
            entry={entry}
            onTrade={onTrade}
            canTrade={canTrade}
          />
        </td>
        <td className="px-3 py-3">
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant={entry.defeated ? "outline" : "ghost"}
              title={entry.defeated ? "Reativar" : "Marcar como derrotado"}
              onClick={() =>
                patchEntry(entry.id, { defeated: !entry.defeated })
              }
            >
              <Skull className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              title="Remover"
              onClick={() => onRemove(entry.id)}
            >
              <Trash2 className="h-4 w-4 text-danger" />
            </Button>
          </div>
        </td>
      </tr>
    </>
  )
}

type InitiativeCardsProps = InitiativeListProps & {
  cardRefs: { current: Map<string, HTMLDivElement> }
}

function InitiativeCards({ cardRefs, ...props }: InitiativeCardsProps) {
  return (
    <div className="overflow-x-auto scroll-smooth p-5">
      <div className="flex min-w-max items-stretch gap-4 pb-2">
        {props.entries.map((entry) => {
          const active = entry.id === props.activeEntryId
          const anchor =
            props.started && entry.id === props.roundAnchorEntryId

          return (
            <div
              key={entry.id}
              ref={(node) => {
                if (node) cardRefs.current.set(entry.id, node)
                else cardRefs.current.delete(entry.id)
              }}
              className="relative flex items-stretch"
            >
              {anchor && (
                <div className="mr-4 flex w-8 shrink-0 flex-col items-center justify-center gap-2 text-danger">
                  <span className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]">
                    Rodada {props.round}
                  </span>
                  <span className="h-full min-h-56 w-0.5 bg-danger" />
                </div>
              )}

              <article
                className={[
                  "flex w-72 shrink-0 flex-col rounded-xl border bg-bg p-4 shadow-theme-sm",
                  "transition-[transform,border-color,box-shadow] duration-300",
                  active
                    ? "scale-[1.03] border-accent shadow-theme-lg"
                    : "border-border",
                  entry.defeated ? "opacity-55" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-3">
                  <EntryIdentity entry={entry} />
                  <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-center">
                    <div className="text-[10px] uppercase text-textMuted">
                      Init.
                    </div>
                    <div className="text-xl font-bold text-textH">
                      {entry.initiative}
                    </div>
                  </div>
                </div>

                {active && (
                  <div className="mt-3 rounded-lg bg-accent px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-white">
                    Turno atual
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border border-border bg-bg-subtle p-3">
                    <div className="text-xs text-textMuted">Pontos de vida</div>
                    <div className="mt-1 font-semibold text-textH">
                      {formatHp(entry)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-subtle p-3">
                    <div className="text-xs text-textMuted">
                      Classe de armadura
                    </div>
                    <div className="mt-1 font-semibold text-textH">
                      {entry.armorClass ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex-1">
                  <ConditionChips
                    entry={entry}
                    onAdd={() => props.onCondition(entry.id)}
                    onRemove={(conditionId) =>
                      props.onRemoveCondition(entry.id, conditionId)
                    }
                  />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <TradeControls
                    entry={entry}
                    onTrade={props.onTrade}
                    canTrade={props.canTrade}
                  />
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant={entry.defeated ? "outline" : "ghost"}
                      title={
                        entry.defeated ? "Reativar" : "Marcar como derrotado"
                      }
                      onClick={() =>
                        props.patchEntry(entry.id, {
                          defeated: !entry.defeated,
                        })
                      }
                    >
                      <Skull className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Remover"
                      onClick={() => props.onRemove(entry.id)}
                    >
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                  </div>
                </div>
              </article>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EntryIdentity({ entry }: { entry: InitiativeEntry }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {entry.imageUrl ? (
        <img
          src={entry.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-bg-subtle">
          <Swords className="h-5 w-5 text-textMuted" />
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate font-semibold text-textH">{entry.name}</div>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${sideClassName(entry.side)}`}
          >
            {sideLabel(entry.side)}
          </span>
          {entry.temporaryHp ? (
            <span className="text-xs text-accent">
              +{entry.temporaryHp} temp.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HitPointEditor({
  entry,
  patchEntry,
}: {
  entry: InitiativeEntry
  patchEntry: (entryId: string, patch: Partial<InitiativeEntry>) => void
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        min={0}
        className={`${compactInputClassName} w-16 text-center`}
        value={entry.currentHp ?? ""}
        onChange={(event) =>
          patchEntry(entry.id, {
            currentHp: optionalNumber(event.target.value),
          })
        }
        title="PV atuais"
      />
      <span className="text-textMuted">/</span>
      <input
        type="number"
        min={0}
        className={`${compactInputClassName} w-16 text-center`}
        value={entry.maxHp ?? ""}
        onChange={(event) =>
          patchEntry(entry.id, { maxHp: optionalNumber(event.target.value) })
        }
        title="PV máximos"
      />
    </div>
  )
}

function ConditionChips({
  entry,
  onAdd,
  onRemove,
}: {
  entry: InitiativeEntry
  onAdd: () => void
  onRemove: (conditionId: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entry.conditions.map((condition) => (
        <span
          key={condition.id}
          title={condition.description}
          className="inline-flex items-center gap-1 rounded-full border border-accentBorder bg-accentBg px-2 py-1 text-xs text-textH"
        >
          <span>{condition.name}</span>
          <span className="text-[10px] text-textMuted">
            {conditionDurationLabel(condition.duration)}
          </span>
          <button
            type="button"
            aria-label={`Remover ${condition.name}`}
            className="rounded-full p-0.5 hover:bg-bg-subtle"
            onClick={() => onRemove(condition.id)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1 rounded-full border border-dashed border-borderStrong px-2 py-1 text-xs text-text hover:border-accent hover:text-accent"
      >
        <CirclePlus className="h-3 w-3" /> Condição
      </button>
    </div>
  )
}

function TradeControls({
  entry,
  onTrade,
  canTrade,
}: {
  entry: InitiativeEntry
  onTrade: (entryId: string, direction: -1 | 1) => void
  canTrade: (entryId: string, direction: -1 | 1) => boolean
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="icon"
        variant="ghost"
        title="Trocar com aliado anterior"
        disabled={!canTrade(entry.id, -1)}
        onClick={() => onTrade(entry.id, -1)}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        title="Trocar com próximo aliado"
        disabled={!canTrade(entry.id, 1)}
        onClick={() => onTrade(entry.id, 1)}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Fechar"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-bg-elevated p-5 shadow-theme-lg"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold text-textH">
            {title}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        {children}
      </section>
    </div>
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

function buildConditionDuration(
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

function conditionDurationLabel(
  duration: InitiativeConditionDuration,
): string {
  switch (duration.type) {
    case "turns":
      return `${duration.remaining}t`
    case "rounds":
      return `${duration.remaining}r`
    case "untilTurnStart":
      return "até início"
    case "untilTurnEnd":
      return "até fim"
    default:
      return "manual"
  }
}

function defaultSideForCharacter(type: string): InitiativeSide {
  if (type === "pc") return "ally"
  if (type === "npc") return "neutral"
  return "enemy"
}

function sideLabel(side: InitiativeSide): string {
  if (side === "ally") return "Aliado"
  if (side === "enemy") return "Inimigo"
  return "Neutro"
}

function sideClassName(side: InitiativeSide): string {
  if (side === "ally") {
    return "border-accentBorder bg-accentBg text-accent"
  }
  if (side === "enemy") {
    return "border-danger bg-transparent text-danger"
  }
  return "border-border bg-bg-subtle text-textMuted"
}

function formatHp(entry: InitiativeEntry): string {
  if (entry.currentHp === undefined && entry.maxHp === undefined) return "—"
  return `${entry.currentHp ?? "—"} / ${entry.maxHp ?? "—"}`
}

function optionalNumber(value: string): number | undefined {
  if (value.trim() === "") return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}
