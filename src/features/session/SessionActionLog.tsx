import { History, Undo2 } from "lucide-react"
import { useMemo } from "react"

import { useCharacterContext } from "../../contexts/characterContext"
import type { SessionHpLogRecord } from "../session-runtime/sessionProtocol"
import { useOptionalSessionRuntime } from "../session-runtime/useSessionRuntime"
import type {
  GameOperation,
  GameOperationRecord,
  InventoryLocation,
} from "../../models/game/GameOperation"

type DisplayRecord =
  | { source: "legacy"; record: GameOperationRecord }
  | { source: "hp"; record: SessionHpLogRecord }

const REST_LEGACY_MATCH_WINDOW_MS = 3_000

export function SessionActionLog() {
  const {
    operationLog,
    visibleCharacters,
    partyInventory,
    groundInventory,
  } = useCharacterContext()
  const runtime = useOptionalSessionRuntime()

  const characterNames = useMemo(
    () => new Map(
      visibleCharacters.map((character) => [
        character.get("id"),
        character.get("name"),
      ]),
    ),
    [visibleCharacters],
  )

  const itemNames = useMemo(() => {
    const entries = [
      ...partyInventory,
      ...groundInventory,
      ...visibleCharacters.flatMap((character) => character.get("inventory") ?? []),
    ]
    return new Map(entries.map((item) => [item.id, item.name]))
  }, [groundInventory, partyInventory, visibleCharacters])

  const latestUndoableHpLogByCharacter = useMemo(() => {
    const latest = new Map<string, string>()
    for (const record of runtime?.hpLog ?? []) {
      if (record.undoneAt || record.operation.type === "character.hp.undo") continue
      latest.set(record.operation.characterId, record.id)
    }
    return latest
  }, [runtime?.hpLog])

  const visibleLegacyRecords = useMemo(() => {
    if (!runtime) return operationLog

    const restRecords = runtime.hpLog.filter(
      (record) =>
        record.operation.type === "character.rest.short" ||
        record.operation.type === "character.rest.long",
    )

    return operationLog.filter((record) => {
      if (record.operation.type === "character.longRest.complete") {
        return !hasMatchingRestRecord(
          restRecords,
          record.operation.characterId,
          record.createdAt,
          "character.rest.long",
        )
      }

      if (record.operation.type === "character.replace") {
        return !hasMatchingRestRecord(
          restRecords,
          record.operation.characterId,
          record.createdAt,
          "character.rest.short",
        )
      }

      return true
    })
  }, [operationLog, runtime])

  const records = useMemo<DisplayRecord[]>(() => [
    ...visibleLegacyRecords.map((record) => ({ source: "legacy" as const, record })),
    ...(runtime?.hpLog ?? []).map((record) => ({ source: "hp" as const, record })),
  ].sort((left, right) =>
    new Date(right.record.createdAt).getTime() - new Date(left.record.createdAt).getTime(),
  ), [runtime?.hpLog, visibleLegacyRecords])

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-bg-elevated xl:flex">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-bg-subtle text-textMuted">
          <History className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-textH">Logs da sessão</div>
          <div className="text-xs text-textMuted">{records.length} ações recentes</div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {records.length ? (
          <div className="flex flex-col gap-2">
            {records.map((entry) =>
              entry.source === "hp" ? (
                <HpLogEntry
                  key={`hp:${entry.record.id}`}
                  record={entry.record}
                  characterNames={characterNames}
                  canUndo={
                    runtime?.role === "MASTER" &&
                    !entry.record.undoneAt &&
                    entry.record.operation.type !== "character.hp.undo" &&
                    latestUndoableHpLogByCharacter.get(entry.record.operation.characterId) === entry.record.id
                  }
                  onUndo={() => runtime?.undoLog(entry.record.id)}
                />
              ) : (
                <LegacyLogEntry
                  key={`legacy:${entry.record.id}`}
                  record={entry.record}
                  characterNames={characterNames}
                  itemNames={itemNames}
                />
              ),
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs leading-5 text-textMuted">
            As ações realizadas durante a sessão aparecerão aqui.
          </div>
        )}
      </div>
    </aside>
  )
}

function hasMatchingRestRecord(
  records: SessionHpLogRecord[],
  characterId: string,
  legacyCreatedAt: string,
  restType: "character.rest.short" | "character.rest.long",
): boolean {
  const legacyTime = new Date(legacyCreatedAt).getTime()
  if (!Number.isFinite(legacyTime)) return false

  return records.some((record) => {
    if (record.operation.type !== restType) return false
    if (record.operation.characterId !== characterId) return false

    const restTime = new Date(record.createdAt).getTime()
    return (
      Number.isFinite(restTime) &&
      Math.abs(restTime - legacyTime) <= REST_LEGACY_MATCH_WINDOW_MS
    )
  })
}

function HpLogEntry({
  record,
  characterNames,
  canUndo,
  onUndo,
}: {
  record: SessionHpLogRecord
  characterNames: ReadonlyMap<string, string>
  canUndo: boolean
  onUndo: () => void
}) {
  const description = describeHpOperation(record.operation, characterNames)
  const timestamp = formatTime(record.createdAt)

  return (
    <article
      className={`rounded-lg border border-border bg-bg px-3 py-2.5 ${record.undoneAt ? "opacity-55" : ""}`}
    >
      <div className={record.undoneAt ? "text-xs leading-5 text-textMuted line-through" : "text-xs leading-5 text-textH"}>
        {description}
      </div>
      {record.undoneAt ? (
        <div className="mt-1 text-[10px] font-medium text-textMuted">
          Desfeito por {record.undoneBy || "MASTER"}.
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-textMuted">
        <span className="truncate" title={record.actorId}>{record.actorId}</span>
        <div className="flex items-center gap-2">
          {canUndo ? (
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-textMuted hover:bg-bg-subtle hover:text-textH"
              title="Desfazer esta alteração"
            >
              <Undo2 className="h-3 w-3" />
              Desfazer
            </button>
          ) : null}
          <time dateTime={record.createdAt}>{timestamp}</time>
        </div>
      </div>
    </article>
  )
}

function LegacyLogEntry({
  record,
  characterNames,
  itemNames,
}: {
  record: GameOperationRecord
  characterNames: ReadonlyMap<string, string>
  itemNames: ReadonlyMap<string, string>
}) {
  const description = describeOperation(record.operation, characterNames, itemNames)
  const timestamp = formatTime(record.createdAt)

  return (
    <article className="rounded-lg border border-border bg-bg px-3 py-2.5">
      <div className="text-xs leading-5 text-textH">{description}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-textMuted">
        <span className="truncate" title={record.actorId}>{record.actorId}</span>
        <time dateTime={record.createdAt}>{timestamp}</time>
      </div>
    </article>
  )
}

function describeHpOperation(
  operation: SessionHpLogRecord["operation"],
  characterNames: ReadonlyMap<string, string>,
): string {
  const characterName = characterNames.get(operation.characterId) ?? "Personagem"

  switch (operation.type) {
    case "character.hp.set":
      return `Definiu os PV de ${characterName} para ${operation.value}.`
    case "character.hp.temporary.set":
      return `Definiu os PV temporários de ${characterName} para ${operation.value}.`
    case "character.hp.temporary.add":
      return `${characterName} recebeu ${operation.amount} PV temporários.`
    case "character.hp.damage":
      return `${characterName} sofreu ${operation.amount} de dano.`
    case "character.hp.heal":
      return `${characterName} recuperou ${operation.amount} PV.`
    case "character.hp.max.set":
      return `Definiu o máximo real de ${characterName} para ${operation.value} PV.`
    case "character.hp.currentMax.adjust":
      return operation.amount > 0
        ? `Aumentou o máximo atual de ${characterName} em ${operation.amount} PV.`
        : `Reduziu o máximo atual de ${characterName} em ${Math.abs(operation.amount)} PV.`
    case "character.hp.currentMax.restore":
      return `Restaurou o máximo atual de ${characterName}.`
    case "character.rest.short":
      return `${characterName} concluiu um descanso curto.`
    case "character.rest.long":
      return `${characterName} concluiu um descanso longo${operation.recovery === "partial" ? " parcial" : ""}.`
    case "character.hp.undo":
      return `Desfez uma alteração de ${characterName}.`
  }
}

function describeOperation(
  operation: GameOperation,
  characterNames: ReadonlyMap<string, string>,
  itemNames: ReadonlyMap<string, string>,
): string {
  const characterName = (id: string) => characterNames.get(id) ?? "Personagem"

  switch (operation.type) {
    case "character.add":
      return `Adicionou ${operation.character.name || "um personagem"} à sessão.`
    case "character.replace":
      return `Atualizou a ficha de ${characterName(operation.characterId)}.`
    case "character.delete":
      return `Removeu ${characterName(operation.characterId)} da sessão.`
    case "character.longRest.complete":
      return `${characterName(operation.characterId)} concluiu um descanso longo.`
    case "character.hp.set":
      return `Definiu os PV de ${characterName(operation.characterId)} para ${operation.value}.`
    case "character.hp.temporary.set":
      return `Definiu os PV temporários de ${characterName(operation.characterId)} para ${operation.value}.`
    case "character.hp.damage":
      return `${characterName(operation.characterId)} sofreu ${operation.amount} de dano.`
    case "character.hp.heal":
      return `${characterName(operation.characterId)} recuperou ${operation.amount} PV.`
    case "character.ability.add":
      return `Adicionou ${operation.ability.name || "uma habilidade"} a ${characterName(operation.characterId)}.`
    case "character.ability.save":
      return `Atualizou ${operation.ability.name || "uma habilidade"} de ${characterName(operation.characterId)}.`
    case "character.ability.remove":
      return `Removeu uma habilidade de ${characterName(operation.characterId)}.`
    case "character.ability.use":
      return `${characterName(operation.characterId)} usou uma habilidade.`
    case "character.ability.restore":
      return `Restaurou uma carga de habilidade de ${characterName(operation.characterId)}.`
    case "character.ability.reset":
      return `Restaurou as habilidades de ${characterName(operation.characterId)}.`
    case "character.spellSlot.spend":
      return `${characterName(operation.characterId)} gastou um espaço de magia de nível ${operation.level}.`
    case "character.spellSlot.restore":
      return `${characterName(operation.characterId)} recuperou um espaço de magia de nível ${operation.level}.`
    case "character.pactSlot.spend":
      return `${characterName(operation.characterId)} gastou um espaço de Pacto.`
    case "character.pactSlot.restore":
      return `${characterName(operation.characterId)} recuperou um espaço de Pacto.`
    case "party.item.add":
      return `Adicionou ${operation.item.name} ao Inventário do grupo.`
    case "party.item.update":
      return `Atualizou ${operation.item.name} no Inventário do grupo.`
    case "party.item.remove":
      return `Removeu ${itemNames.get(operation.itemId) ?? "um item"} do Inventário do grupo.`
    case "ground.item.add":
      return `Colocou ${operation.item.name} no chão.`
    case "ground.item.update":
      return `Atualizou ${operation.item.name} no chão.`
    case "ground.item.remove":
      return `Removeu ${itemNames.get(operation.itemId) ?? "um item"} do chão.`
    case "inventory.item.transfer": {
      const itemName = itemNames.get(operation.request.itemId) ?? "Item"
      return `Moveu ${operation.request.quantity}× ${itemName} de ${locationLabel(operation.request.from, characterNames)} para ${locationLabel(operation.request.to, characterNames)}.`
    }
  }
}

function locationLabel(
  location: InventoryLocation,
  characterNames: ReadonlyMap<string, string>,
): string {
  if (location.type === "party") return "Inventário do grupo"
  if (location.type === "ground") return "Chão"
  return characterNames.get(location.characterId) ?? "um personagem"
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })
}
