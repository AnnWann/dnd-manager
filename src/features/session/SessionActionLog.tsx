import { History, Undo2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import { useCharacterContext } from "../../contexts/characterContext"
import { isLatestUndoableSessionLog, type SessionLogRecord } from "../session-runtime/sessionLogProtocol"
import type { SessionSkill } from "../session-runtime/sessionProtocol"
import { useOptionalSessionRuntime } from "../session-runtime/useSessionRuntime"
import type {
  GameOperation,
  GameOperationRecord,
  InventoryLocation,
} from "../../models/game/GameOperation"

type DisplayRecord =
  | { source: "legacy"; record: GameOperationRecord }
  | { source: "session"; record: SessionLogRecord }

const REST_LEGACY_MATCH_WINDOW_MS = 3_000
const LOG_PAGE_SIZE = 20

export function SessionActionLog() {
  const { operationLog, visibleCharacters, partyInventory, groundInventory } = useCharacterContext()
  const runtime = useOptionalSessionRuntime()
  const sessionLog = (runtime?.hpLog ?? []) as SessionLogRecord[]
  const [page, setPage] = useState(0)

  const characterNames = useMemo(
    () => new Map(visibleCharacters.map((character) => [character.get("id"), character.get("name")])),
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

  const visibleLegacyRecords = useMemo(() => {
    if (!runtime) return operationLog
    const restRecords = sessionLog.filter(
      (record) => record.operation.type === "character.rest.short" || record.operation.type === "character.rest.long",
    )

    return operationLog.filter((record) => {
      if (record.operation.type === "character.longRest.complete") {
        return !hasMatchingRestRecord(restRecords, record.operation.characterId, record.createdAt, "character.rest.long")
      }
      if (record.operation.type === "character.replace") {
        return !hasMatchingRestRecord(restRecords, record.operation.characterId, record.createdAt, "character.rest.short")
      }
      return true
    })
  }, [operationLog, runtime, sessionLog])

  const records = useMemo<DisplayRecord[]>(() => [
    ...visibleLegacyRecords.map((record) => ({ source: "legacy" as const, record })),
    ...sessionLog.map((record) => ({ source: "session" as const, record })),
  ].sort((left, right) => new Date(right.record.createdAt).getTime() - new Date(left.record.createdAt).getTime()), [sessionLog, visibleLegacyRecords])

  const pageCount = Math.max(1, Math.ceil(records.length / LOG_PAGE_SIZE))
  const visibleRecords = useMemo(
    () => records.slice(page * LOG_PAGE_SIZE, (page + 1) * LOG_PAGE_SIZE),
    [page, records],
  )

  useEffect(() => {
    if (page < pageCount) return
    setPage(Math.max(0, pageCount - 1))
  }, [page, pageCount])

  return (
    <aside className="hidden w-80 shrink-0 flex-col border-l border-border bg-bg-elevated xl:flex">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-bg-subtle text-textMuted"><History className="h-4 w-4" /></div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-textH">Logs da sessão</div>
          <div className="text-xs text-textMuted">{records.length} ações recentes</div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {records.length ? (
          <div className="flex flex-col gap-2">
            {visibleRecords.map((entry) => entry.source === "session" ? (
              <SessionLogEntry
                key={`session:${entry.record.id}`}
                record={entry.record}
                characterNames={characterNames}
                canUndo={runtime?.role === "MASTER" && isLatestUndoableSessionLog(sessionLog, entry.record)}
                onUndo={() => runtime?.undoLog(entry.record.id)}
              />
            ) : (
              <LegacyLogEntry
                key={`legacy:${entry.record.id}`}
                record={entry.record}
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

      {records.length > LOG_PAGE_SIZE ? (
        <footer className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-border p-3 text-[11px] text-textMuted">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => Math.max(0, current - 1))}
            className="rounded-lg border border-border px-2 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40 hover:bg-bg-subtle"
          >
            Mais recentes
          </button>
          <span>{page + 1}/{pageCount}</span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
            className="rounded-lg border border-border px-2 py-1.5 text-right disabled:cursor-not-allowed disabled:opacity-40 hover:bg-bg-subtle"
          >
            Mais antigos
          </button>
        </footer>
      ) : null}
    </aside>
  )
}

function hasMatchingRestRecord(
  records: SessionLogRecord[],
  characterId: string,
  legacyCreatedAt: string,
  restType: "character.rest.short" | "character.rest.long",
): boolean {
  const legacyTime = new Date(legacyCreatedAt).getTime()
  if (!Number.isFinite(legacyTime)) return false
  return records.some((record) => {
    if (record.operation.type !== restType || record.operation.characterId !== characterId) return false
    const restTime = new Date(record.createdAt).getTime()
    return Number.isFinite(restTime) && Math.abs(restTime - legacyTime) <= REST_LEGACY_MATCH_WINDOW_MS
  })
}

function SessionLogEntry({ record, characterNames, canUndo, onUndo }: {
  record: SessionLogRecord
  characterNames: ReadonlyMap<string, string>
  canUndo: boolean
  onUndo: () => void
}) {
  const description = describeSessionOperation(record.operation, characterNames)
  const timestamp = formatTime(record.createdAt)
  return (
    <article className={`rounded-lg border border-border bg-bg px-3 py-2.5 ${record.undoneAt ? "opacity-55" : ""}`}>
      <div className={record.undoneAt ? "text-xs leading-5 text-textMuted line-through" : "text-xs leading-5 text-textH"}>{description}</div>
      {record.undoneAt ? <div className="mt-1 text-[10px] font-medium text-textMuted">Desfeito por {record.undoneBy || "MASTER"}.</div> : null}
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-textMuted">
        <span className="truncate" title={record.actorId}>{record.actorId}</span>
        <div className="flex items-center gap-2">
          {canUndo ? (
            <button type="button" onClick={onUndo} className="inline-flex items-center gap-1 rounded px-1.5 py-1 font-medium text-textMuted hover:bg-bg-subtle hover:text-textH" title="Desfazer esta alteração">
              <Undo2 className="h-3 w-3" /> Desfazer
            </button>
          ) : null}
          <time dateTime={record.createdAt}>{timestamp}</time>
        </div>
      </div>
    </article>
  )
}

function LegacyLogEntry({ record, characterNames, itemNames }: {
  record: GameOperationRecord
  characterNames: ReadonlyMap<string, string>
  itemNames: ReadonlyMap<string, string>
}) {
  const description = describeOperation(record.operation, characterNames, itemNames)
  return (
    <article className="rounded-lg border border-border bg-bg px-3 py-2.5">
      <div className="text-xs leading-5 text-textH">{description}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-textMuted">
        <span className="truncate" title={record.actorId}>{record.actorId}</span>
        <time dateTime={record.createdAt}>{formatTime(record.createdAt)}</time>
      </div>
    </article>
  )
}

function describeSessionOperation(operation: SessionLogRecord["operation"], characterNames: ReadonlyMap<string, string>): string {
  const characterName = characterNames.get(operation.characterId) ?? "Personagem"
  switch (operation.type) {
    case "character.hp.set": return `Definiu os PV de ${characterName} para ${operation.value}.`
    case "character.hp.temporary.set": return `Definiu os PV temporários de ${characterName} para ${operation.value}.`
    case "character.hp.temporary.add": return `${characterName} recebeu ${operation.amount} PV temporários.`
    case "character.hp.damage": return `${characterName} sofreu ${operation.amount} de dano.`
    case "character.hp.heal": return `${characterName} recuperou ${operation.amount} PV.`
    case "character.hp.max.set": return `Definiu o máximo real de ${characterName} para ${operation.value} PV.`
    case "character.hp.currentMax.adjust": return operation.amount > 0 ? `Aumentou o máximo atual de ${characterName} em ${operation.amount} PV.` : `Reduziu o máximo atual de ${characterName} em ${Math.abs(operation.amount)} PV.`
    case "character.hp.currentMax.restore": return `Restaurou o máximo atual de ${characterName}.`
    case "character.hitDice.use": return `${characterName} usou ${operation.amount} ${operation.side} de vida.`
    case "character.hitDice.recover": return `${characterName} recuperou ${operation.amount} ${operation.side} de vida.`
    case "character.hitDice.add": return `Adicionou ${operation.amount} ${operation.side} de vida a ${characterName}.`
    case "character.hitDice.remove": return `Removeu o pool ${operation.side} de dados de vida de ${characterName}.`
    case "character.attribute.set": return `Definiu ${attributeLabel(operation.attribute)} de ${characterName} para ${operation.value}.`
    case "character.savingThrow.set": return operation.proficient ? `${characterName} ganhou proficiência no teste de resistência de ${attributeLabel(operation.attribute)}.` : `${characterName} perdeu proficiência no teste de resistência de ${attributeLabel(operation.attribute)}.`
    case "character.skill.set": {
      const skill = skillLabel(operation.skill)
      if (operation.proficiency === "expertise") return `${characterName} ganhou especialização em ${skill}.`
      if (operation.proficiency === "proficient") return `${characterName} ganhou proficiência em ${skill}.`
      return `${characterName} perdeu a proficiência manual em ${skill}.`
    }
    case "character.condition.add": return `Adicionou a condição ${operation.condition.name} a ${characterName}.`
    case "character.condition.update": return `Editou a condição ${operation.condition.name} de ${characterName}.`
    case "character.condition.remove": return `Removeu uma condição de ${characterName}.`
    case "character.concentration.start": return `${characterName} começou a concentrar em ${operation.spellName}.`
    case "character.concentration.end": return operation.reason === "failed-save" ? `${characterName} falhou no teste e perdeu a concentração.` : `${characterName} encerrou a concentração.`
    case "character.stat.armorClass.set": return `Definiu a CA de ${characterName} para ${formatStat(operation.value)}.`
    case "character.stat.initiative.set": return `Definiu a iniciativa de ${characterName} para ${formatSignedStat(operation.value)}.`
    case "character.stat.mobility.set": return `Definiu a mobilidade de ${characterName} para ${formatStat(operation.value)}.`
    case "character.stat.passivePerception.set": return `Definiu a percepção passiva de ${characterName} para ${formatStat(operation.value)}.`
    case "character.stat.exhaustion.set": return `Definiu a exaustão de ${characterName} para ${operation.value}.`
    case "character.stat.inspiration.set": return operation.value ? `${characterName} recebeu inspiração.` : `${characterName} gastou a inspiração.`
    case "character.stat.experience.set": return `Definiu a experiência de ${characterName} para ${operation.value.toLocaleString("pt-BR")} XP.`
    case "character.rest.short": return `${characterName} concluiu um descanso curto.`
    case "character.rest.long": return `${characterName} concluiu um descanso longo${operation.recovery === "partial" ? " parcial" : ""}.`
    case "character.ability.save": return `Atualizou ${operation.ability.name || "uma habilidade"} de ${characterName}.`
    case "character.ability.remove": return `Removeu ${operation.abilityName || "uma habilidade"} de ${characterName}.`
    case "character.ability.use": return `${characterName} usou ${operation.abilityName || "uma habilidade"}.`
    case "character.ability.usage.spend": return `${characterName} gastou um uso de ${operation.abilityName || "uma habilidade"}.`
    case "character.ability.restore": return `Restaurou uma carga de ${operation.abilityName || "habilidade"} de ${characterName}.`
    case "character.ability.deactivate": return `Desativou ${operation.abilityName || "uma habilidade"} de ${characterName}.`
    case "character.customSystem.field.set": return `${characterName} alterou um campo do sistema ${operation.systemId}.`
    case "character.customSystem.field.remove": return `${characterName} removeu o valor de um campo do sistema ${operation.systemId}.`
    case "character.customSystem.resource.set": return `${characterName} definiu o recurso ${operation.resourceId} do sistema ${operation.systemId}.`
    case "character.customSystem.resource.adjust": return `${characterName} ${operation.amount > 0 ? "aumentou" : "reduziu"} ${operation.resourceId} em ${Math.abs(operation.amount)}.`
    case "character.customSystem.resource.reset": return `${characterName} restaurou o recurso ${operation.resourceId}.`
    case "character.customSystem.ability.add": return `${characterName} adicionou uma habilidade do sistema ${operation.systemId}.`
    case "character.customSystem.ability.remove": return `${characterName} removeu uma habilidade do sistema ${operation.systemId}.`
    case "character.customSystem.ability.field.set": return `${characterName} editou uma habilidade do sistema ${operation.systemId}.`
    case "character.customSystem.ability.learned.set": return `${characterName} ${operation.learned ? "aprendeu" : "desaprendeu"} uma habilidade do sistema ${operation.systemId}.`
    case "character.customSystem.ability.prepared.set": return `${characterName} ${operation.prepared ? "preparou" : "despreparou"} uma habilidade do sistema ${operation.systemId}.`
    case "character.customSystem.ability.usage.set": return `Definiu os usos de uma habilidade de ${characterName} para ${operation.used}.`
    case "character.customSystem.ability.activate": return `${characterName} usou uma habilidade do sistema ${operation.systemId}.`
    case "character.customSystem.action.execute": return `${characterName} executou uma ação do sistema ${operation.systemId}.`
    case "character.customSystem.automation.execute": return `${characterName} executou uma automação manual do sistema ${operation.systemId}.`
    case "character.spell.prepare": return `${operation.prepared ? "Preparou" : "Despreparou"} ${operation.spellIndex} para ${characterName}.`
    case "character.spell.add": return `Adicionou uma magia à lista de ${characterName}.`
    case "character.spell.remove": return `Removeu ${operation.spellIndex} da lista de ${characterName}.`
    case "character.spell.castingDescription.add": return `Adicionou uma descrição de conjuração para ${operation.spellIndex} de ${characterName}.`
    case "character.spell.castingDescription.update": return `Editou uma descrição de conjuração de ${operation.spellIndex} de ${characterName}.`
    case "character.spell.castingDescription.remove": return `Removeu uma descrição de conjuração de ${operation.spellIndex} de ${characterName}.`
    case "character.spellSlot.spend": return `${characterName} gastou um espaço de magia de nível ${operation.level}.`
    case "character.spellSlot.restore": return `${characterName} recuperou um espaço de magia de nível ${operation.level}.`
    case "character.pactSlot.spend": return `${characterName} gastou um espaço de Pacto.`
    case "character.pactSlot.restore": return `${characterName} recuperou um espaço de Pacto.`
    case "character.customSpellSlot.spend": return `${characterName} gastou um espaço de magia customizado de nível ${operation.level}.`
    case "character.customSpellSlot.restore": return `${characterName} recuperou um espaço de magia customizado de nível ${operation.level}.`
    case "character.metamagic.add": return `Adicionou a metamagia ${operation.metamagicId} a ${characterName}.`
    case "character.metamagic.remove": return `Removeu a metamagia ${operation.metamagicId} de ${characterName}.`
    case "character.sorceryPoint.spend": return `${characterName} gastou 1 ponto de feitiçaria.`
    case "character.sorceryPoint.restore": return `${characterName} recuperou 1 ponto de feitiçaria.`
    case "character.ki.spend": return `${characterName} gastou 1 ponto de Ki.`
    case "character.ki.restore": return `${characterName} recuperou 1 ponto de Ki.`
    case "character.channelDivinity.spend": return `${characterName} gastou 1 uso de Canalizar Divindade.`
    case "character.channelDivinity.restore": return `${characterName} recuperou 1 uso de Canalizar Divindade.`
    case "character.equipment.item.update": return `Atualizou um equipamento de ${characterName}.`
    case "character.equipment.move": return `Moveu um equipamento de ${characterName} para ${operation.destination === "pocket" ? "o bolso" : "o inventário"}.`
    case "character.equipment.attunement.toggle": return `Alterou a sintonia de um item de ${characterName}.`
    case "character.equipment.pocket.unequip": return `${characterName} tirou um item do bolso.`
    case "character.equipment.pocket.wield": return `${characterName} empunhou uma arma do bolso.`
    case "character.equipment.pocket.use": return `${characterName} usou um item do bolso.`
    case "character.inventory.item.add": return `Adicionou um item ao inventário de ${characterName}.`
    case "character.inventory.item.update": return `Atualizou um item do inventário de ${characterName}.`
    case "character.inventory.item.remove": return `Removeu um item do inventário de ${characterName}.`
    case "character.inventory.item.consume": return `${characterName} consumiu um item.`
    case "character.inventory.item.equip": return `${characterName} equipou um item do inventário.`
    case "character.inventory.bag.toggle": return `${characterName} moveu um item para dentro/fora da Bolsa Mágica.`
    case "character.inventory.currenciesBag.set": return `${characterName} ${operation.insideBagOfHolding ? "guardou" : "retirou"} as moedas da Bolsa Mágica.`
    case "character.inventory.attunement.toggle": return `${characterName} alterou a sintonia de um item.`
    case "inventory.item.transfer": return `Transferiu ${operation.request.quantity}× item de ${locationLabel(operation.request.from, characterNames)} para ${locationLabel(operation.request.to, characterNames)}.`
    case "party.item.add": return `Adicionou um item ao inventário do grupo.`
    case "party.item.update": return `Atualizou um item do inventário do grupo.`
    case "party.item.remove": return `Removeu um item do inventário do grupo.`
    case "party.settings.carryCapacity.set": return `Definiu a capacidade de transporte do grupo para ${formatStat(operation.value)}.`
    case "party.settings.additionalSupplyConsumption.set": return `Definiu o consumo adicional do grupo para ${formatStat(operation.value)} porções por descanso.`
    case "ground.item.add": return `Adicionou um item ao chão.`
    case "ground.item.update": return `Atualizou um item no chão.`
    case "ground.item.remove": return `Removeu um item no chão.`
    case "character.equipment.move.ground": return `${characterName} colocou um equipamento no chão.`
    case "mission.add": return `Adicionou a missão “${operation.mission.title || "Sem título"}”.`
    case "mission.update": return `Atualizou a missão “${operation.mission.title || "Sem título"}”.`
    case "mission.delete": return `Excluiu uma missão da sessão.`
    case "mission.status.set": return `Moveu uma missão para ${missionStatusLabel(operation.status)}.`
    case "mission.objective.toggle": return `Alterou o estado de um objetivo de missão.`
    case "initiative.entries.add": return operation.entries.length === 1 ? `Adicionou um participante à iniciativa.` : `Adicionou ${operation.entries.length} participantes à iniciativa.`
    case "initiative.entry.update": return `Atualizou um participante da iniciativa.`
    case "initiative.entry.remove": return `Removeu um participante da iniciativa.`
    case "initiative.sort": return `Ordenou a iniciativa.`
    case "initiative.combat.start": return `Iniciou o combate.`
    case "initiative.combat.end": return `Encerrou o combate.`
    case "initiative.turn.next": return `Avançou para o próximo turno da iniciativa.`
    case "initiative.turn.previous": return `Voltou para o turno anterior da iniciativa.`
    case "initiative.allies.trade": return `Trocou a ordem de dois aliados na iniciativa.`
    case "initiative.viewMode.set": return `Alterou a visualização da iniciativa para ${operation.viewMode === "cards" ? "cartões" : "tabela"}.`
    case "initiative.reset": return `Limpou o combate atual.`
    case "character.proficiency.add": return `${characterName} ganhou a proficiência ${operation.proficiency.name}.`
    case "character.proficiency.remove": return `${characterName} perdeu a proficiência ${operation.proficiencyName || "selecionada"}.`
    case "character.race.replace": return `${characterName} atualizou a raça.`
    case "character.race.spells.replace": return `${characterName} atualizou as magias raciais.`
    case "character.profile.replace": return `${characterName} atualizou o perfil.`
    case "character.profile.background.save": return `${characterName} atualizou o antecedente.`
    case "character.profile.background.remove": return `${characterName} removeu o antecedente.`
    case "character.session.add": return `Adicionou ${characterName} à sessão.`
    case "character.session.remove": return `Removeu ${characterName} da sessão.`
    case "character.session.owner.set": return `Alterou o jogador responsável por ${characterName}.`
    case "character.session.resync": return `Ressincronizou ${characterName} com a sessão.`
    case "character.hp.undo": return `Desfez uma alteração de ${characterName}.`
  }
}

function describeOperation(operation: GameOperation, characterNames: ReadonlyMap<string, string>, itemNames: ReadonlyMap<string, string>): string {
  const characterName = (id: string) => characterNames.get(id) ?? "Personagem"
  switch (operation.type) {
    case "character.add": return `Adicionou ${operation.character.name || "um personagem"} à sessão.`
    case "character.replace": return `Atualizou a ficha de ${characterName(operation.characterId)}.`
    case "character.delete": return `Removeu ${characterName(operation.characterId)} da sessão.`
    case "character.longRest.complete": return `${characterName(operation.characterId)} concluiu um descanso longo.`
    case "character.hp.set": return `Definiu os PV de ${characterName(operation.characterId)} para ${operation.value}.`
    case "character.hp.temporary.set": return `Definiu os PV temporários de ${characterName(operation.characterId)} para ${operation.value}.`
    case "character.hp.damage": return `${characterName(operation.characterId)} sofreu ${operation.amount} de dano.`
    case "character.hp.heal": return `${characterName(operation.characterId)} recuperou ${operation.amount} PV.`
    case "character.ability.add": return `Adicionou ${operation.ability.name || "uma habilidade"} a ${characterName(operation.characterId)}.`
    case "character.ability.save": return `Atualizou ${operation.ability.name || "uma habilidade"} de ${characterName(operation.characterId)}.`
    case "character.ability.remove": return `Removeu uma habilidade de ${characterName(operation.characterId)}.`
    case "character.ability.use": return `${characterName(operation.characterId)} usou uma habilidade.`
    case "character.ability.restore": return `Restaurou uma carga de habilidade de ${characterName(operation.characterId)}.`
    case "character.ability.reset": return `Restaurou as habilidades de ${characterName(operation.characterId)}.`
    case "character.spellSlot.spend": return `${characterName(operation.characterId)} gastou um espaço de magia de nível ${operation.level}.`
    case "character.spellSlot.restore": return `${characterName(operation.characterId)} recuperou um espaço de magia de nível ${operation.level}.`
    case "character.pactSlot.spend": return `${characterName(operation.characterId)} gastou um espaço de Pacto.`
    case "character.pactSlot.restore": return `${characterName(operation.characterId)} recuperou um espaço de Pacto.`
    case "party.item.add": return `Adicionou ${operation.item.name} ao Inventário do grupo.`
    case "party.item.update": return `Atualizou ${operation.item.name} no Inventário do grupo.`
    case "party.item.remove": return `Removeu ${itemNames.get(operation.itemId) ?? "um item"} do Inventário do grupo.`
    case "ground.item.add": return `Colocou ${operation.item.name} no chão.`
    case "ground.item.update": return `Atualizou ${operation.item.name} no chão.`
    case "ground.item.remove": return `Removeu ${itemNames.get(operation.itemId) ?? "um item"} do chão.`
    case "inventory.item.transfer": {
      const itemName = itemNames.get(operation.request.itemId) ?? "Item"
      return `Moveu ${operation.request.quantity}× ${itemName} de ${locationLabel(operation.request.from, characterNames)} para ${locationLabel(operation.request.to, characterNames)}.`
    }
  }
}

function attributeLabel(attribute: "str" | "dex" | "con" | "int" | "wis" | "cha"): string {
  return ({ str: "FOR", dex: "DES", con: "CON", int: "INT", wis: "SAB", cha: "CAR" })[attribute]
}

function skillLabel(skill: SessionSkill): string {
  const labels: Record<SessionSkill, string> = {
    acrobatics: "Acrobacia",
    arcana: "Arcanismo",
    athletics: "Atletismo",
    animalHandling: "Lidar com Animais",
    performance: "Atuação",
    deception: "Blefe",
    stealth: "Furtividade",
    history: "História",
    intimidation: "Intimidação",
    insight: "Intuição",
    investigation: "Investigação",
    medicine: "Medicina",
    nature: "Natureza",
    perception: "Percepção",
    persuasion: "Persuasão",
    sleightOfHand: "Prestidigitação",
    religion: "Religião",
    survival: "Sobrevivência",
  }
  return labels[skill]
}

function missionStatusLabel(status: "available" | "accepted" | "completed"): string {
  return ({ available: "Disponíveis", accepted: "Aceitas", completed: "Concluídas" })[status]
}

function locationLabel(location: InventoryLocation, characterNames: ReadonlyMap<string, string>): string {
  if (location.type === "party") return "Inventário do grupo"
  if (location.type === "ground") return "Chão"
  return characterNames.get(location.characterId) ?? "um personagem"
}

function formatStat(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
}

function formatSignedStat(value: number): string {
  return `${value >= 0 ? "+" : ""}${formatStat(value)}`
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
