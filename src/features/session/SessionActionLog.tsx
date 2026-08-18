import { History } from "lucide-react"
import { useMemo } from "react"

import { useCharacterContext } from "../../contexts/characterContext"
import type {
  GameOperation,
  GameOperationRecord,
  InventoryLocation,
} from "../../models/game/GameOperation"

export function SessionActionLog() {
  const {
    operationLog,
    visibleCharacters,
    partyInventory,
    groundInventory,
  } = useCharacterContext()

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

  const records = [...operationLog].reverse()

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
            {records.map((record) => (
              <LogEntry
                key={record.id}
                record={record}
                characterNames={characterNames}
                itemNames={itemNames}
              />
            ))}
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

function LogEntry({
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
