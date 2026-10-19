import React, { useCallback, useEffect, useMemo, useState } from "react"
import { MemoryRouter } from "react-router-dom"
import { CharacterTemplate, type CharacterTemplateProps } from "../../web/src/models/characters/CharacterTemplate"
import { withCharacterConditions } from "../../web/src/models/characters/characterConditionStorage"
import { CharacterWorkspaceProvider, type CharacterWorkspaceValue } from "../../web/src/features/characters/workspace/CharacterWorkspaceContext"
import { SessionRuntimeContext, type SessionRuntimeContextValue } from "../../web/src/features/session-runtime/SessionRuntimeProvider"
import { MagicProvider } from "../../web/src/contexts/magicContext"
import { CharacterSheetTab } from "../../web/src/features/characters/characterSheet/characterSheet"
import { CharacterAbilitiesTab } from "../../web/src/features/characters/abilities/characterAbilities"
import { CharacterMagicTab } from "../../web/src/features/characters/magic/characterMagicModule"
import { CharacterEquipmentTab } from "../../web/src/features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../../web/src/features/characters/inventory/characterInventory"
import { CharacterProficienciesTab } from "../../web/src/features/characters/proficiencies/characterProficiencies"
import { CharacterRaceTab } from "../../web/src/features/characters/race/characterRaceV2"
import { CharacterProfileTab } from "../../web/src/features/characters/profile/characterProfileV2"
import { SharedCharacterTabs } from "@dnd-manager/game-ui/shared-character-tabs"
import { setRuntimeCustomSystemOverride } from "../../web/src/lib/customSystems/creationCustomSystemsBridge"

type Raw = Record<string, unknown>
type Props = {
  characterId: string
  raw: Raw
  hp?: Raw
  conditions?: Raw
  runtimeConfig?: Raw | null
  role: "MASTER" | "PLAYER"
  sessionId: string
  connected: boolean
  send: (message: Raw) => boolean
}

function same(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b) }
const obj = (value: unknown): Raw => value && typeof value === "object" && !Array.isArray(value) ? value as Raw : {}
function ensureCharacter(raw: Raw, hp: Raw | undefined, conditions: Raw | undefined) {
  const sheet = obj(raw.sheet)
  const hitpoints = obj(sheet.HP)
  const state = hp ?? {}
  const projected = CharacterTemplate.fromJSON({
    ...raw,
    sheet: {
      ...sheet,
      HP: {
        ...hitpoints,
        current: state.current ?? hitpoints.current,
        max: state.max ?? hitpoints.max,
        temporary: state.temporary ?? hitpoints.temporary,
        hitDice: state.hitDice ? Object.fromEntries(Object.entries(obj(state.hitDice)).map(([side,pool]) => [side,{ current:{quantity:Number(obj(pool).current),sides:side}, max:{quantity:Number(obj(pool).max),sides:side}}])) : hitpoints.hitDice,
      },
      attributes: state.attributesInitialized ? state.attributes : sheet.attributes,
      savingThrowProficiencies: state.savingThrowsInitialized ? state.savingThrows : sheet.savingThrowProficiencies,
      skills: state.skillsInitialized ? state.skills : sheet.skills,
      conditions: sheet.conditions,
      stats: state.statsInitialized ? { ...obj(sheet.stats), ...obj(state.stats) } : sheet.stats,
    },
  } as Partial<CharacterTemplateProps>)
  return conditions?.initialized && Array.isArray(conditions.conditions)
    ? withCharacterConditions(projected, conditions.conditions as Parameters<typeof withCharacterConditions>[1])
    : projected
}

/** Adapter for the original website components, not a rewritten character sheet.
 * Every mutation goes to the authoritative DO; unsupported diffs are rejected.
 */
export function NativeCharacterSheetHost({ characterId, raw, hp, conditions, runtimeConfig, role, sessionId, connected, send }: Props) {
  const [notice, setNotice] = useState("")
  useEffect(() => {
    const config = obj(runtimeConfig?.config)
    setRuntimeCustomSystemOverride(Array.isArray(config.customSystems) ? config.customSystems as never : null)
    return () => setRuntimeCustomSystemOverride(null)
  }, [runtimeConfig])
  const character = useMemo(() => ensureCharacter(raw, hp, conditions), [raw, hp, conditions])
  const safeSend = useCallback((message: Raw) => {
    if (!connected) { setNotice("Sessão desconectada. Nenhuma alteração foi salva."); return false }
    const success = send(message)
    if (!success) setNotice("A operação não foi enviada ao servidor.")
    return success
  }, [connected, send])

  const dispatch = useCallback((type: string, operation: unknown) => safeSend({ type, operation }), [safeSend])
  const reject = useCallback((label: string) => {
    setNotice("Operação não suportada pelo adaptador: " + label + ". Nenhuma alteração foi salva.")
  }, [])

  const updateCharacter = useCallback((_id: string, updater: (value: CharacterTemplate) => CharacterTemplate) => {
    if (_id !== characterId) return
    let next: CharacterTemplate
    try { next = updater(character) } catch (error) { reject(String(error)); return }
    const before = character.toJSON()
    const after = next.toJSON()
    if (same(before, after)) return
    const left = obj(before), right = obj(after), leftSheet = obj(left.sheet), rightSheet = obj(right.sheet)
    const actions: Raw[] = []
    const prevInventory = Array.isArray(left.inventory) ? left.inventory as Raw[] : []
    const nextInventory = Array.isArray(right.inventory) ? right.inventory as Raw[] : []
    if (!same(prevInventory, nextInventory)) {
      const prev = new Map(prevInventory.map(item => [String(item.id), item]))
      const next = new Map(nextInventory.map(item => [String(item.id), item]))
      for (const [id, item] of next) {
        if (!prev.has(id)) actions.push({type:"session.inventory.operation",operation:{type:"character.inventory.item.add",characterId,item}})
        else if (!same(prev.get(id),item)) actions.push({type:"session.inventory.operation",operation:{type:"character.inventory.item.update",characterId,itemId:id,item}})
      }
      for (const id of prev.keys()) if (!next.has(id)) actions.push({type:"session.inventory.operation",operation:{type:"character.inventory.item.remove",characterId,itemId:id}})
    }
    if (!same(left.profile, right.profile))
      actions.push({type:"session.profile.operation",operation:{type:"character.profile.replace",characterId,profile:right.profile}})
    if (!same(leftSheet.race,rightSheet.race))
      actions.push({type:"session.race.operation",operation:{type:"character.race.replace",characterId,race:rightSheet.race,skills:rightSheet.skills,savingThrowProficiencies:rightSheet.savingThrowProficiencies}})
    const oldAbilities = Array.isArray(left.abilities) ? left.abilities as Raw[] : []
    const newAbilities = Array.isArray(right.abilities) ? right.abilities as Raw[] : []
    if (!same(oldAbilities,newAbilities)) {
      const prev = new Map(oldAbilities.map(a => [String(a.id),a]))
      const next = new Map(newAbilities.map(a => [String(a.id),a]))
      for (const [id, ability] of next) if (!same(prev.get(id),ability))
        actions.push({type:"session.abilities.operation",operation:{type:"character.ability.save",characterId,ability}})
      for (const id of prev.keys()) if (!next.has(id))
        actions.push({type:"session.abilities.operation",operation:{type:"character.ability.remove",characterId,abilityId:id}})
    }
    // For composite equipment and spellcasting changes, only semantic server
    // operations are safe. Do not silently persist the local CharacterTemplate.
    const handled = new Set(["inventory","profile","abilities"])
    for (const key of Object.keys(right)) {
      if (handled.has(key) || same(left[key],right[key])) continue
      if (key !== "sheet") { reject(key); return }
    }
    for (const key of Object.keys(rightSheet)) {
      if (key === "race" || same(leftSheet[key],rightSheet[key])) continue
      reject("sheet." + key)
      return
    }
    if (actions.length === 0) { reject("sem operação correspondente"); return }
    if (actions.length > 1) { reject("alteração composta não atômica"); return }
    safeSend(actions[0])
  }, [character,characterId,reject,safeSend])

  const noop = () => false
  const runtime = {
    status: connected ? "connected" : "disconnected",
    sessionId, clientId: "", role, presence: [], lastHeartbeatAckAt: null,
    runtimeConfigSnapshot: runtimeConfig,
    hpByCharacterId: hp ? {[characterId]:hp} : {},
    abilitiesByCharacterId: {[characterId]: {characterId, character:raw, initialized:true, revision:0}},
    conditionsByCharacterId: conditions ? {[characterId]:conditions} : {},
    sessionCharactersById: {[characterId]: {characterId,character:raw,active:true}},
    characterSnapshotReady: true, inventoryState:null, missionState:null, initiativeState:null,
    publishRuntimeConfig:noop, initializeAbilities:noop, initializeHp:noop, initializeConditions:noop,
    initializeInventory:noop,initializeMissions:noop,initializeInitiative:noop,
    dispatchSheetOperation:(operation:unknown)=>dispatch("session.hp.operation",operation),
    dispatchHpOperation:(operation:unknown)=>dispatch("session.hp.operation",operation),
    dispatchConditionOperation:(operation:unknown)=>dispatch("session.conditions.operation",operation),
    dispatchConcentrationOperation:(operation:unknown)=>dispatch("session.hp.operation",operation),
    dispatchAbilityOperation:(operation:unknown)=>dispatch("session.abilities.operation",operation),
    dispatchMagicOperation:(operation:unknown)=>dispatch("session.magic.operation",operation),
    dispatchEquipmentOperation:(operation:unknown)=>dispatch("session.equipment.operation",operation),
    dispatchInventoryOperation:(operation:unknown)=>dispatch("session.inventory.operation",operation),
    dispatchMissionOperation:noop,dispatchInitiativeOperation:noop,
    dispatchProficiencyOperation:(operation:unknown)=>dispatch("session.proficiency.operation",operation),
    dispatchRaceOperation:(operation:unknown)=>dispatch("session.race.operation",operation),
    dispatchProfileOperation:(operation:unknown)=>dispatch("session.profile.operation",operation),
    dispatchCustomClassOperation:(operation:unknown)=>dispatch("session.custom-class.operation",operation),
    dispatchCustomSystemOperation:(operation:unknown)=>dispatch("session.customSystem.operation",operation),
    dispatchCharacterLifecycleOperation:(operation:unknown)=>dispatch("session.character.operation",operation),
  } as unknown as SessionRuntimeContextValue
  const workspace = {
    mode:"campaign",characters:[character],activeCharacter:character,selectedCharacterId:characterId,
    setSelectedCharacterId:()=>{},updateCharacter,updateCharacterDomain:(_id:string,_domain:string,fn:(c:CharacterTemplate)=>CharacterTemplate)=>updateCharacter(_id,fn),
    dispatchStatOperation:(op:unknown)=>dispatch("session.hp.operation",op),
    dispatchAttributeOperation:(op:unknown)=>dispatch("session.hp.operation",op),
    dispatchSavingThrowOperation:(op:unknown)=>dispatch("session.hp.operation",op),
    dispatchSkillOperation:(op:unknown)=>dispatch("session.hp.operation",op),
    dispatchConditionOperation:(op:unknown)=>dispatch("session.conditions.operation",op),
    canAssignOwners:role==="MASTER",canEditCharacterType:role==="MASTER",canUseGroundInventory:false,
    partyInventory:[],owners:[],knownPlayerKeys:[],getOwner:()=>({id:"",name:"",role:"player"}),
    createOwner:()=>{throw new Error("Não é permitido criar proprietários pelo Owlbear")},
    currentOwner:undefined,
    deleteCharacter:()=>reject("exclusão de personagem"),
    completeLongRest:()=>reject("descanso longo"),
    stowHandOccupant:()=>reject("equipar / guardar"),
    moveEquippedItem:()=>reject("mover equipamento"),
    dispatchGameOperation:()=>reject("operação de jogo"),
  } as unknown as CharacterWorkspaceValue

  return <MemoryRouter>
    <MagicProvider spells={[]}>
      <SessionRuntimeContext.Provider value={runtime}>
        <CharacterWorkspaceProvider value={workspace}>
          {notice ? <p role="alert" className="error">{notice}</p> : null}
          <SharedCharacterTabs key={characterId} sections={{
            sheet:<CharacterSheetTab character={character} updateCharacter={updateCharacter}/>,
            abilities:<CharacterAbilitiesTab character={character} updateCharacter={updateCharacter}/>,
            "spells-list":<CharacterMagicTab character={character} updateCharacter={updateCharacter}/>,
            equipment:<CharacterEquipmentTab character={character} updateCharacter={updateCharacter}/>,
            inventory:<CharacterInventoryTab character={character} updateCharacter={updateCharacter}/>,
            race:<CharacterRaceTab character={character} updateCharacter={updateCharacter}/>,
            profile:<CharacterProfileTab character={character} updateCharacter={updateCharacter}/>,
            proficiencies:<CharacterProficienciesTab character={character} updateCharacter={updateCharacter}/>,
          }}/>
        </CharacterWorkspaceProvider>
      </SessionRuntimeContext.Provider>
    </MagicProvider>
  </MemoryRouter>
}
