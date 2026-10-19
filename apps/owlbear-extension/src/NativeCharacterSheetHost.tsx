import React, { useCallback, useEffect, useMemo, useState } from "react"
import { MemoryRouter } from "react-router-dom"
import { CharacterTemplate, type CharacterTemplateProps } from "../../web/src/models/characters/CharacterTemplate"
import { withCharacterConditions } from "../../web/src/models/characters/characterConditionStorage"
import { CharacterWorkspaceProvider, type CharacterWorkspaceValue } from "../../web/src/features/characters/workspace/CharacterWorkspaceContext"
import { SessionRuntimeContext, type SessionRuntimeContextValue } from "../../web/src/features/session-runtime/SessionRuntimeProvider"
import { MagicProvider } from "../../web/src/contexts/magicContext"
import type { Spell } from "../../web/src/models/magic/spells/Spell"
import { CharacterSheetTab } from "../../web/src/features/characters/characterSheet/characterSheet"
import { CharacterAbilitiesTab } from "../../web/src/features/characters/abilities/characterAbilities"
import { CharacterMagicTab } from "../../web/src/features/characters/magic/characterMagicModule"
import { CharacterEquipmentTab } from "../../web/src/features/characters/equipment/characterEquipment"
import { CharacterInventoryTab } from "../../web/src/features/characters/inventory/characterInventory"
import { CharacterProficienciesTab } from "../../web/src/features/characters/proficiencies/characterProficiencies"
import { CharacterRaceTab } from "../../web/src/features/characters/race/characterRaceV2"
import { CharacterProfileTab } from "../../web/src/features/characters/profile/characterProfileV2"
import { SharedCharacterTabs } from "@dnd-manager/game-ui/shared-character-tabs"
import { toSheetOperationMessage } from "../../web/src/features/session-runtime/sheetRoutes"
import { deriveEquipmentOperations, deriveMagicOperations, deriveProficiencyOperations, deriveCustomSystemOperations, deriveConcentrationOperation, deriveGrantedSpellUsageOperation, resolveHandReference } from "../../web/src/features/characters/workspace/SessionCharacterWorkspace"
import { ACTION_ROLL_REQUEST_EVENT, CREATURE_ROLL_REQUEST_EVENT, DICE_ROLL_REQUEST_EVENT } from "../../web/src/lib/diceRoller"
import { setRuntimeCustomSystemOverride } from "../../web/src/lib/customSystems/creationCustomSystemsBridge"

type Raw = Record<string, unknown>
type Props = {
  characterId: string
  raw: Raw
  hp?: Raw
  conditions?: Raw
  runtimeConfig?: Raw | null
  inventoryState?: Raw | null
  spells?: Raw[]
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
export function NativeCharacterSheetHost({ characterId, raw, hp, conditions, runtimeConfig, inventoryState, spells, role, sessionId, connected, send }: Props) {
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

  const sendSheet = (operation: unknown) =>
    safeSend(toSheetOperationMessage(operation as Parameters<typeof toSheetOperationMessage>[0]) as unknown as Raw)

  const updateCharacter = useCallback((_id: string, updater: (value: CharacterTemplate) => CharacterTemplate) => {
    if (_id !== characterId || !connected) return
    let next: CharacterTemplate
    try { next = updater(character) } catch (error) { reject(String(error)); return }
    if (same(character.toJSON(),next.toJSON())) return
    const ownerChanged = !same(character.get("owner"),next.get("owner"))
    const magicChanged = !same(character.get("magic"),next.get("magic"))
    const equipmentChanged = !same(character.get("equipment"),next.get("equipment"))
    const inventoryChanged = !same(character.get("inventory"),next.get("inventory"))
    const proficiencyChanged = !same(character.get("sheet").proficiencies,next.get("sheet").proficiencies)
    const customSystemsChanged = !same(character.get("sheet").customSystems,next.get("sheet").customSystems)
    const concentration = deriveConcentrationOperation(character,next)
    const grantedUsage = deriveGrantedSpellUsageOperation(character,next)
    if (ownerChanged) {
      if (!same(character.withPatch({owner:next.get("owner")}).toJSON(),next.toJSON())) return reject("mudança composta de proprietário")
      dispatch("session.character.operation",{type:"character.session.owner.set",characterId,owner:next.get("owner")})
      return
    }
    if (grantedUsage) {
      dispatch("session.abilities.operation",grantedUsage)
      if (concentration) sendSheet(concentration)
      return
    }
    if (equipmentChanged || inventoryChanged) {
      const ops=deriveEquipmentOperations(character,next)
      if (ops.length) {
        ops.forEach(op=>dispatch("session.equipment.operation",op))
        if (concentration) sendSheet(concentration)
        return
      }
      if (!equipmentChanged && inventoryChanged) {
        const before = character.get("inventory") ?? []
        const after = next.get("inventory") ?? []
        const prev = new Map(before.map(item=>[item.id,item]))
        const curr = new Map(after.map(item=>[item.id,item]))
        const outgoing: Raw[]=[]
        for (const [itemId,item] of curr) {
          if (!prev.has(itemId)) outgoing.push({type:"character.inventory.item.add",characterId,item})
          else if (!same(prev.get(itemId),item)) outgoing.push({type:"character.inventory.item.update",characterId,itemId,item})
        }
        for (const itemId of prev.keys()) if (!curr.has(itemId))
          outgoing.push({type:"character.inventory.item.remove",characterId,itemId})
        if (outgoing.length===1) {
          dispatch("session.inventory.operation",outgoing[0])
          return
        }
      }
      return reject("mudança de equipamento/inventário sem operação semântica")
    }
    if (magicChanged) {
      const ops=deriveMagicOperations(character,next)
      if (!ops.length && !concentration) return reject("magia")
      ops.forEach(op=>dispatch("session.magic.operation",op))
      if (concentration) sendSheet(concentration)
      return
    }
    if (proficiencyChanged) {
      const ops=deriveProficiencyOperations(character,next)
      if (!ops.length) return reject("proficiências")
      ops.forEach(op=>dispatch("session.proficiency.operation",op))
      return
    }
    if (customSystemsChanged) {
      const ops=deriveCustomSystemOperations(character,next)
      if (!ops.length) return reject("sistemas customizados")
      ops.forEach(op=>dispatch("session.abilities.operation",op))
      return
    }
    if (concentration) {sendSheet(concentration);return}
    return reject("alteração não reconhecida pela API da sessão")
  }, [character,characterId,connected,dispatch,reject,safeSend])


  useEffect(() => {
    const forward = (eventName: string, type: string) => (event: Event) => {
      const detail = (event as CustomEvent).detail
      if (!detail || !connected) return
      if (eventName === DICE_ROLL_REQUEST_EVENT && obj(runtimeConfig?.config).diceRollingEnabled === false) return
      safeSend({type,request:detail})
    }
    const events = [[DICE_ROLL_REQUEST_EVENT,"session.dice.roll"],[ACTION_ROLL_REQUEST_EVENT,"session.action.roll"],[CREATURE_ROLL_REQUEST_EVENT,"session.creature.roll"]] as const
    const handlers = events.map(([event,type])=>[event,forward(event,type)] as const)
    handlers.forEach(([event,handler])=>window.addEventListener(event,handler))
    return () => handlers.forEach(([event,handler])=>window.removeEventListener(event,handler))
  }, [connected,runtimeConfig,safeSend])
  const noop = () => false
  const runtime = {
    status: connected ? "connected" : "disconnected",
    sessionId, clientId: "", role, presence: [], lastHeartbeatAckAt: null,
    runtimeConfigSnapshot: runtimeConfig,
    hpByCharacterId: hp ? {[characterId]:hp} : {},
    abilitiesByCharacterId: {[characterId]: {characterId, character:raw, initialized:true, revision:0}},
    conditionsByCharacterId: conditions ? {[characterId]:conditions} : {},
    sessionCharactersById: {[characterId]: {characterId,character:raw,active:true}},
    characterSnapshotReady: true, inventoryState:inventoryState ?? null, missionState:null, initiativeState:null,
    publishRuntimeConfig:noop, initializeAbilities:noop, initializeHp:noop, initializeConditions:noop,
    initializeInventory:noop,initializeMissions:noop,initializeInitiative:noop,
    dispatchSheetOperation:(operation:unknown)=>sendSheet(operation),
    dispatchHpOperation:(operation:unknown)=>sendSheet(operation),
    dispatchConditionOperation:(operation:unknown)=>dispatch("session.conditions.operation",operation),
    dispatchConcentrationOperation:(operation:unknown)=>sendSheet(operation),
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
    dispatchStatOperation:(op:unknown)=>sendSheet(op),
    dispatchAttributeOperation:(op:unknown)=>sendSheet(op),
    dispatchSavingThrowOperation:(op:unknown)=>sendSheet(op),
    dispatchSkillOperation:(op:unknown)=>sendSheet(op),
    dispatchConditionOperation:(op:unknown)=>dispatch("session.conditions.operation",op),
    canAssignOwners:role==="MASTER",canEditCharacterType:role==="MASTER",canUseGroundInventory:inventoryState?.partyInventoryAccessible !== false,
    partyInventory:Array.isArray(inventoryState?.partyInventory) ? inventoryState.partyInventory : [],owners:[],knownPlayerKeys:[],getOwner:()=>({id:"",name:"",role:"player"}),
    createOwner:()=>{throw new Error("Não é permitido criar proprietários pelo Owlbear")},
    currentOwner:undefined,
    deleteCharacter:()=>reject("exclusão de personagem"),
    completeLongRest:()=>reject("descanso longo"),
    stowHandOccupant:()=>reject("equipar / guardar"),
    moveEquippedItem:()=>reject("mover equipamento"),
    dispatchGameOperation:()=>reject("operação de jogo"),
  } as unknown as CharacterWorkspaceValue

  return <MemoryRouter>
    <MagicProvider spells={(spells ?? []) as Spell[]}>
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
