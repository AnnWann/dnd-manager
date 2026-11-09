import { ResourcePill } from "../../../../../../packages/game-ui/src/ResourcePill"
import { getAbilityUsageMax, getSharedAbilityUsage } from "../../../models/abilities/abilityActivation"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getChannelDivinityPool, restoreChannelDivinity, spendChannelDivinity } from "../../../models/characters/characterChannelDivinity"
import { getKiPool, restoreKi, spendKi } from "../../../models/characters/characterKi"
import { getSorceryPoints, restorePactSlot, restoreSorceryPoint, restoreSpellSlot, spendPactSlot, spendSorceryPoint, spendSpellSlot } from "../../../models/characters/characterMagic"
import { getCustomSpellSlotPools, restoreCustomSpellSlot, spendCustomSpellSlot } from "../../../models/characters/customClassConfig"
import { spendGrantedSpellAbilityUse } from "../../../models/characters/characterGrantedSpells"
import { meetsUnlockRequirements } from "../../../models/magic/spells/grantedSpellUnlocks"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"
import type { SessionAbilitySource } from "../../session-runtime/abilitySessionProtocol"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

type Props = {
  character: CharacterTemplate
  updateCharacter: (id: string, updater: (character: CharacterTemplate) => CharacterTemplate) => void
}

type AbilityPool = {
  id: string
  name: string
  current: number
  max: number
  source: SessionAbilitySource
  chargeSource: Parameters<typeof spendGrantedSpellAbilityUse>[1]
}

/** Single place to adjust all combat counters, including spell-granting item abilities. */
export function CharacterResourcePanel({ character, updateCharacter }: Props) {
  const runtime = useOptionalSessionRuntime()
  const id = character.get("id")
  const slots = character.getSpellSlots()
  const pact = character.getPactSlots()
  const sorcery = getSorceryPoints(character)
  const ki = getKiPool(character)
  const channel = getChannelDivinityPool(character)
  const customSlots = getCustomSpellSlotPools(character)

  const pools = new Map<string, AbilityPool>()
  const racialAbilities: Ability[] = (character.get("sheet").race.naturalAbilities ?? []).map(ability => ({ ...ability, source: "race" }))
  for (const ability of [...character.getCharacterAbilities(), ...racialAbilities]) {
    if (!ability.usage || ability.usage.reset === "spellSlot" || !meetsUnlockRequirements(character, ability.unlockRequirements)) continue
    // Class pools are displayed separately and must never be duplicated.
    if (ability.category === "channelDivinity" || ability.category === "martialArts") continue
    const source = abilitySource(ability)
    const chargeSource = source
    const resourceId = ability.usage.sharedResourceId?.trim()
    const key = resourceId ? `shared:${resourceId}` :
      source.type === "equipment" ? `equipment:${source.itemId}:${source.abilityId}` :
      source.type === "condition" ? `condition:${source.conditionId}:${source.abilityId}` :
      `${source.type}:${source.abilityId}`
    if (pools.has(key)) continue
    const usage = getSharedAbilityUsage(character, ability) ?? ability.usage
    const max = getAbilityUsageMax(character, usage)
    if (max <= 0) continue
    pools.set(key, {
      id: key,
      name: usage.sharedResourceName?.trim() || ability.name,
      current: Math.max(0, max - usage.used),
      max,
      source,
      chargeSource,
    })
  }

  const itemSpellPools = character.getEquippedItems().flatMap(item =>
    (item.spells ?? []).filter(grant => grant.usage?.reset !== "spellSlot" && isGrantedSpellUnlocked(character, grant)).map(grant => {
      const max = getAbilityUsageMax(character, grant.usage)
      return { id: `${item.id}:${grant.index}`, itemId: item.id, name: `${item.name} — ${grant.index}`,
        grant, current: Math.max(0, max - grant.usage.used), max }
    }).filter(pool => pool.max > 0)
  )

  function adjustItemSpell(itemId: string, grant: typeof itemSpellPools[number]["grant"], delta: -1 | 1) {
    updateCharacter(id, current => {
      const max = getAbilityUsageMax(current, grant.usage)
      const nextUsed = Math.max(0, Math.min(max, grant.usage.used - delta))
      if (nextUsed === grant.usage.used) return current
      return current.updateEquipmentSpell(itemId, { ...grant, usage: { ...grant.usage, used: nextUsed } })
    })
  }

  function adjustAbility(pool: AbilityPool, delta: 1 | -1) {
    if (runtime) {
      if (runtime.status !== "connected") return
      runtime.dispatchAbilityOperation(delta === -1
        ? { type: "character.ability.usage.spend", characterId: id, source: pool.chargeSource, abilityName: pool.name }
        : { type: "character.ability.restore", characterId: id, source: pool.source, abilityName: pool.name })
      return
    }
    updateCharacter(id, current => {
      if (delta === -1) return spendGrantedSpellAbilityUse(current, pool.chargeSource)
      const source = pool.source
      switch (source.type) {
        case "equipment": return current.restoreEquipmentAbility(source.itemId, source.abilityId)
        case "race": {
          const race = current.get("sheet").race
          return current.withSheet("race", { ...race, naturalAbilities: (race.naturalAbilities ?? []).map(ability =>
            ability.id === source.abilityId && ability.usage
              ? { ...ability, usage: { ...ability.usage, used: Math.max(0, ability.usage.used - 1) } }
              : ability) })
        }
        case "character": return current.restoreAbility(pool.source.abilityId)
        case "condition": return current.restoreAbility(`condition:${source.conditionId}:${pool.source.abilityId}`)
      }
    })
  }

  const hasSpells = Object.values(slots).some(slot => slot && slot.max > 0) || Boolean(pact?.max) || customSlots.length > 0
  const hasClassResources = sorcery.max > 0 || Boolean(ki?.max) || Boolean(channel?.max)
  if (!hasSpells && !hasClassResources && !pools.size && !itemSpellPools.length) return null

  return <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
    <h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Recursos</h2>
    <p className="mt-1 text-[11px] text-textMuted">Consuma ou devolva uma carga com −/+. Os valores usam os mesmos contadores das magias e habilidades.</p>
    {hasSpells ? <div className="mt-3">
      <div className="mb-2 text-[11px] font-semibold text-textH">Espaços de magia</div>
      <div className="flex flex-wrap gap-2">
        {Object.entries(slots).map(([level, slot]) => slot && slot.max > 0 ?
          <ResourcePill key={level} label={`N${level}`} current={slot.current} max={slot.max}
            onDecrease={() => updateCharacter(id, current => spendSpellSlot(current, Number(level) as MagicCircleLevel))}
            onIncrease={() => updateCharacter(id, current => restoreSpellSlot(current, Number(level) as MagicCircleLevel))} /> : null)}
        {pact?.max ? <ResourcePill label={`Pacto N${pact.level}`} current={pact.current} max={pact.max}
          onDecrease={() => updateCharacter(id, spendPactSlot)}
          onIncrease={() => updateCharacter(id, restorePactSlot)} /> : null}
        {customSlots.flatMap(pool => Object.values(pool.slots).map(slot =>
          <ResourcePill key={`${pool.id}:${slot.level}`} label={`${pool.name} N${slot.level}`}
            current={slot.current} max={slot.max}
            onDecrease={() => updateCharacter(id, current => spendCustomSpellSlot(current, pool.id, slot.level))}
            onIncrease={() => updateCharacter(id, current => restoreCustomSpellSlot(current, pool.id, slot.level))} />))}
      </div>
    </div> : null}
    {hasClassResources ? <div className="mt-3">
      <div className="mb-2 text-[11px] font-semibold text-textH">Recursos de classe</div>
      <div className="flex flex-wrap gap-2">
        {sorcery.max > 0 ? <ResourcePill label="Pontos de feitiçaria" current={sorcery.current} max={sorcery.max}
          onDecrease={() => updateCharacter(id, spendSorceryPoint)}
          onIncrease={() => updateCharacter(id, restoreSorceryPoint)} /> : null}
        {ki ? <ResourcePill label="Ki" current={ki.current} max={ki.max}
          onDecrease={() => updateCharacter(id, spendKi)} onIncrease={() => updateCharacter(id, restoreKi)} /> : null}
        {channel ? <ResourcePill label="Canalizar Divindade" current={channel.current} max={channel.max}
          onDecrease={() => updateCharacter(id, spendChannelDivinity)}
          onIncrease={() => updateCharacter(id, restoreChannelDivinity)} /> : null}
      </div>
    </div> : null}
    {pools.size || itemSpellPools.length ? <div className="mt-3">
      <div className="mb-2 text-[11px] font-semibold text-textH">Habilidades e equipamentos</div>
      <div className="flex flex-wrap gap-2">
        {[...pools.values()].map(pool => <ResourcePill key={pool.id} label={pool.name} current={pool.current} max={pool.max}
          onDecrease={() => adjustAbility(pool, -1)} onIncrease={() => adjustAbility(pool, 1)} />)}
        {itemSpellPools.map(pool => <ResourcePill key={pool.id} label={pool.name} current={pool.current} max={pool.max}
          onDecrease={() => adjustItemSpell(pool.itemId, pool.grant, -1)} onIncrease={() => adjustItemSpell(pool.itemId, pool.grant, 1)} />)}
      </div>
    </div> : null}
  </section>
}

function abilitySource(ability: Ability): SessionAbilitySource {
  if (ability.source === "equipment" && ability.sourceItemId && ability.originalAbilityId)
    return { type: "equipment", itemId: ability.sourceItemId, abilityId: ability.originalAbilityId }
  if (ability.source === "race") return { type: "race", abilityId: ability.originalAbilityId ?? ability.id }
  if (ability.source === "condition" && ability.sourceConditionId && ability.originalAbilityId)
    return { type: "condition", conditionId: ability.sourceConditionId, abilityId: ability.originalAbilityId }
  return { type: "character", abilityId: ability.id }
}
