import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CirclePlus,
  Grid2X2,
  List,
  Play,
  RotateCcw,
  Shield,
  Swords,
  UserPlus,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Modal } from "../components/ui/Modal"
import { useCharacterContext } from "../contexts/characterContext"
import { useCreatureCompendium } from "../contexts/creatureCompendiumContext"
import { useSyncContext } from "../contexts/syncContext"
import {
  CreatureQuickSheet,
  quickSheetFromCharacter,
  quickSheetFromCompendiumCreature,
  quickSheetFromInitiativeEntry,
  type CombatQuickSheetData,
} from "../features/creatures/CreatureQuickSheet"
import { InitiativeCards } from "../features/initiative/InitiativeCards"
import {
  ConditionDialog,
  CustomEntryDialog,
  type CustomInitiativeEntryDraft,
  type InitiativeConditionInput,
} from "../features/initiative/InitiativeDialogs"
import { InitiativeTable } from "../features/initiative/InitiativeTable"
import { useInitiativeSession } from "../hooks/useInitiativeSession"
import type { CompendiumCreature } from "../models/creatures/CompendiumCreature"
import { getEffectiveArmorClassWithShield } from "../models/items/equipment/Shield"
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
  type InitiativeEntry,
  type InitiativeSide,
} from "../models/initiative/Initiative"

const COMPENDIUM_SOURCE_PREFIX = "compendium:"
const selectClassName =
  "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export function InitiativeView() {
  const { visibleCharacters } = useCharacterContext()
  const { creatures } = useCreatureCompendium()
  const { userRole } = useSyncContext()
  const { session, updateSession, resetSession, hydrated } =
    useInitiativeSession()

  const [selectedCharacterId, setSelectedCharacterId] = useState("")
  const [selectedCharacterSide, setSelectedCharacterSide] =
    useState<InitiativeSide>("ally")
  const [selectedCreatureId, setSelectedCreatureId] = useState("")
  const [selectedCreatureSide, setSelectedCreatureSide] =
    useState<InitiativeSide>("enemy")
  const [creatureQuantity, setCreatureQuantity] = useState(1)
  const [sharedCreatureInitiative, setSharedCreatureInitiative] =
    useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [conditionTargetId, setConditionTargetId] = useState<string>()
  const [quickSheetEntryId, setQuickSheetEntryId] = useState<string>()
  const cardRefs = useRef(new Map<string, HTMLDivElement>())

  const selectedCharacter = visibleCharacters.find(
    (character) => character.get("id") === selectedCharacterId,
  )
  const selectedCreature = creatures.find(
    (creature) => creature.id === selectedCreatureId,
  )
  const activeEntry = session.entries.find(
    (entry) => entry.id === session.activeEntryId,
  )
  const conditionTarget = session.entries.find(
    (entry) => entry.id === conditionTargetId,
  )
  const quickSheetEntry = session.entries.find(
    (entry) => entry.id === quickSheetEntryId,
  )

  const quickSheetData = useMemo(
    () =>
      quickSheetEntry
        ? resolveQuickSheet(
            quickSheetEntry,
            visibleCharacters,
            creatures,
          )
        : undefined,
    [creatures, quickSheetEntry, visibleCharacters],
  )
  const quickSheetPrefersImage = Boolean(
    quickSheetEntry?.sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX) &&
      quickSheetData?.sheetImageUrl,
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

  useEffect(() => {
    if (!selectedCreature) return
    setSelectedCreatureSide(selectedCreature.defaultSide)
  }, [selectedCreature])

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
          armorClass: getEffectiveArmorClassWithShield(selectedCharacter),
          currentHp: sheet.HP.current,
          maxHp: selectedCharacter.getEffectiveMaxHp(),
          temporaryHp: selectedCharacter.getEffectiveTemporaryHp(),
        },
      ]),
    )
  }

  function addSelectedCreature() {
    if (!selectedCreature) return

    const sourceId = `${COMPENDIUM_SOURCE_PREFIX}${selectedCreature.id}`
    const existingCopies = session.entries.filter(
      (entry) => entry.sourceId === sourceId,
    ).length

    if (selectedCreature.unique && existingCopies > 0) return

    const quantity = selectedCreature.unique
      ? 1
      : clamp(Math.trunc(creatureQuantity), 1, 50)
    const sharedRoll = sharedCreatureInitiative
      ? rollInitiative(selectedCreature.initiativeBonus)
      : undefined

    const entries = Array.from({ length: quantity }, (_, index) => ({
      sourceId,
      sourceType: creatureSourceType(selectedCreature),
      name: selectedCreature.unique
        ? selectedCreature.name
        : `${selectedCreature.name} ${existingCopies + index + 1}`,
      imageUrl: selectedCreature.sheetImageUrl,
      initiative:
        sharedRoll ?? rollInitiative(selectedCreature.initiativeBonus),
      initiativeBonus: selectedCreature.initiativeBonus,
      dexterity: selectedCreature.abilityScores.dex,
      side: selectedCreatureSide,
      armorClass: selectedCreature.armorClass,
      currentHp: selectedCreature.maxHp,
      maxHp: selectedCreature.maxHp,
      temporaryHp: 0,
    }))

    updateSession((current) => addInitiativeEntries(current, entries))
  }

  function addCustomEntries(draft: CustomInitiativeEntryDraft) {
    const existingCopies = session.entries.filter(
      (entry) =>
        entry.name === draft.name || entry.name.startsWith(`${draft.name} `),
    ).length
    const sharedRoll = draft.sharedInitiative
      ? rollInitiative(draft.initiativeBonus)
      : undefined

    const entries = Array.from({ length: draft.quantity }, (_, index) => ({
      sourceType: draft.sourceType,
      name:
        draft.quantity === 1 && existingCopies === 0
          ? draft.name
          : `${draft.name} ${existingCopies + index + 1}`,
      initiative: sharedRoll ?? rollInitiative(draft.initiativeBonus),
      initiativeBonus: draft.initiativeBonus,
      side: draft.side,
      armorClass: draft.armorClass,
      currentHp: draft.maxHp,
      maxHp: draft.maxHp,
      temporaryHp: 0,
    }))

    updateSession((current) => addInitiativeEntries(current, entries))
    setCustomOpen(false)
  }

  function applyCondition(condition: InitiativeConditionInput) {
    if (!conditionTargetId) return

    updateSession((current) =>
      applyInitiativeCondition(current, conditionTargetId, condition),
    )
    setConditionTargetId(undefined)
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
    return <MasterOnlyMessage />
  }

  const rosterProps = {
    entries: session.entries,
    activeEntryId: session.activeEntryId,
    roundAnchorEntryId: session.roundAnchorEntryId,
    round: session.round,
    started: session.started,
    patchEntry,
    onOpen: setQuickSheetEntryId,
    onCondition: setConditionTargetId,
    onRemove: (entryId: string) =>
      updateSession((current) => removeInitiativeEntry(current, entryId)),
    onTrade: (entryId: string, direction: -1 | 1) =>
      updateSession((current) =>
        tradeConsecutiveAllies(current, entryId, direction),
      ),
    canTrade: (entryId: string, direction: -1 | 1) =>
      canTradeConsecutiveAllies(session, entryId, direction),
    onRemoveCondition: (entryId: string, conditionId: string) =>
      updateSession((current) =>
        removeInitiativeCondition(current, entryId, conditionId),
      ),
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <InitiativeHeader
        round={session.round}
        activeName={activeEntry?.name}
        viewMode={session.viewMode}
        onViewMode={(viewMode) =>
          updateSession((current) => ({
            ...current,
            viewMode,
            updatedAt: Date.now(),
          }))
        }
        onClear={clearCombat}
      />

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-textH">
            <UserPlus className="h-4 w-4 text-accent" />
            Adicionar ficha existente
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_9rem_auto]">
            <select
              className={selectClassName}
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
              className={selectClassName}
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
              Adicionar
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-textH">
            <BookOpen className="h-4 w-4 text-accent" />
            Adicionar do Compêndio de Criaturas
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_5rem_auto_auto]">
            <select
              className={selectClassName}
              value={selectedCreatureId}
              onChange={(event) => setSelectedCreatureId(event.target.value)}
              disabled={session.started}
            >
              <option value="">Selecione uma criatura</option>
              {creatures.map((creature) => {
                const sourceId = `${COMPENDIUM_SOURCE_PREFIX}${creature.id}`
                const alreadyAdded = session.entries.some(
                  (entry) => entry.sourceId === sourceId,
                )
                const disabled = creature.unique && alreadyAdded

                return (
                  <option
                    key={creature.id}
                    value={creature.id}
                    disabled={disabled}
                  >
                    {creature.name}
                    {disabled ? " — já adicionada" : ""}
                  </option>
                )
              })}
            </select>
            <select
              className={selectClassName}
              value={selectedCreatureSide}
              onChange={(event) =>
                setSelectedCreatureSide(event.target.value as InitiativeSide)
              }
              disabled={session.started}
              title="Lado da criatura"
            >
              <option value="ally">Aliado</option>
              <option value="enemy">Inimigo</option>
              <option value="neutral">Neutro</option>
            </select>
            <Input
              type="number"
              min={1}
              max={50}
              value={selectedCreature?.unique ? 1 : creatureQuantity}
              disabled={session.started || selectedCreature?.unique}
              onChange={(event) => setCreatureQuantity(Number(event.target.value))}
              title="Quantidade"
            />
            <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-textH">
              <input
                type="checkbox"
                checked={sharedCreatureInitiative}
                disabled={session.started}
                onChange={(event) =>
                  setSharedCreatureInitiative(event.target.checked)
                }
              />
              Iniciativa conjunta
            </label>
            <Button
              variant="primary"
              onClick={addSelectedCreature}
              disabled={!selectedCreature || session.started}
            >
              <CirclePlus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <Button onClick={() => setCustomOpen(true)} disabled={session.started}>
          <Swords className="h-4 w-4" />
          Entrada rápida
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
            Encerrar combate
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => updateSession(startInitiativeCombat)}
            disabled={session.entries.length === 0}
          >
            <Play className="h-4 w-4" />
            Iniciar combate
          </Button>
        )}
      </section>

      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">
              {session.entries.length} participante
              {session.entries.length === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-textMuted">
              Clique no nome ou cartão para abrir a ficha rápida.
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
          <EmptyRoster />
        ) : session.viewMode === "table" ? (
          <InitiativeTable {...rosterProps} />
        ) : (
          <InitiativeCards {...rosterProps} cardRefs={cardRefs} />
        )}
      </section>

      {customOpen ? (
        <CustomEntryDialog
          onClose={() => setCustomOpen(false)}
          onAdd={addCustomEntries}
        />
      ) : null}

      {conditionTarget ? (
        <ConditionDialog
          targetName={conditionTarget.name}
          targetEntryId={conditionTarget.id}
          entries={session.entries}
          activeEntryId={session.activeEntryId}
          onClose={() => setConditionTargetId(undefined)}
          onApply={applyCondition}
        />
      ) : null}

      {quickSheetEntry && quickSheetData ? (
        <Modal
          title={`Ficha rápida — ${quickSheetEntry.name}`}
          onClose={() => setQuickSheetEntryId(undefined)}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={quickSheetData}
            preferImage={quickSheetPrefersImage}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function InitiativeHeader({
  round,
  activeName,
  viewMode,
  onViewMode,
  onClear,
}: {
  round: number
  activeName?: string
  viewMode: "table" | "cards"
  onViewMode: (mode: "table" | "cards") => void
  onClear: () => void
}) {
  return (
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
              Rodada {round}
            </span>
          </div>
          <p className="mt-1 text-sm text-text">
            {activeName
              ? `Turno atual: ${activeName}`
              : "Adicione os participantes e inicie o combate."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={viewMode === "table" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onViewMode("table")}
          >
            <List className="h-4 w-4" />
            Tabela
          </Button>
          <Button
            variant={viewMode === "cards" ? "primary" : "secondary"}
            size="sm"
            onClick={() => onViewMode("cards")}
          >
            <Grid2X2 className="h-4 w-4" />
            Cartões
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear}>
            <RotateCcw className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>
    </section>
  )
}

function MasterOnlyMessage() {
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

function EmptyRoster() {
  return (
    <div className="p-10 text-center">
      <Swords className="mx-auto h-10 w-10 text-textMuted" />
      <div className="mt-3 text-sm font-semibold text-textH">
        Nenhum participante
      </div>
      <div className="mt-1 text-sm text-text">
        Adicione fichas, criaturas do compêndio ou entradas rápidas.
      </div>
    </div>
  )
}

function resolveQuickSheet(
  entry: InitiativeEntry,
  characters: ReturnType<typeof useCharacterContext>["visibleCharacters"],
  creatures: CompendiumCreature[],
): CombatQuickSheetData {
  if (entry.sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX)) {
    const creatureId = entry.sourceId.slice(COMPENDIUM_SOURCE_PREFIX.length)
    const creature = creatures.find((candidate) => candidate.id === creatureId)
    if (creature) return quickSheetFromCompendiumCreature(creature, entry)
  }

  if (entry.sourceId) {
    const character = characters.find(
      (candidate) => candidate.get("id") === entry.sourceId,
    )
    if (character) return quickSheetFromCharacter(character, entry)
  }

  return quickSheetFromInitiativeEntry(entry)
}

function creatureSourceType(
  creature: CompendiumCreature,
): "npc" | "monster" | "custom" {
  const category = creature.category.toLocaleLowerCase()
  if (category.includes("npc") || category.includes("personagem")) return "npc"
  if (category.includes("outro")) return "custom"
  return "monster"
}

function defaultSideForCharacter(type: string): InitiativeSide {
  if (type === "pc") return "ally"
  if (type === "npc") return "neutral"
  return "enemy"
}

function clamp(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.min(maximum, Math.max(minimum, value))
}
