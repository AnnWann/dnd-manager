import { CreatureQuickSheet, quickSheetFromCompendiumCreature } from "../../web/src/features/creatures/CreatureQuickSheet"
import type { CompendiumCreature } from "../../web/src/models/creatures/CompendiumCreature"
import { CreatureTokenInspector } from "./CreatureTokenInspector"
import type { InitiativeEntry } from "../../web/src/models/initiative/Initiative"
import { readSelectedToken, readTokenCharacterLink, setTokenCharacterLink, readTokenCreatureLink, setTokenCreatureLink, readTokenCompendiumCreature, TOKEN_COMPENDIUM_CREATURE_METADATA } from "./tokenCharacterLink"
import { SessionDicePanel, type DiceHistoryEntry } from "./SessionDicePanel"
import { SessionTransport } from "@dnd-manager/session-client/transport"
import { NativeCharacterSheetHost } from "./NativeCharacterSheetHost"
import { publishServerDiceRoll, publishServerActionRoll } from "../../web/src/lib/diceRoller"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import OBR from "@owlbear-rodeo/sdk"
import { CharacterSheetDerivedTile } from "@dnd-manager/game-ui/character-sheet-fields"
import { SharedCharacterTabs } from "@dnd-manager/game-ui/shared-character-tabs"
import { SharedSessionHp } from "@dnd-manager/game-ui/shared-session-hp"
import { CharacterSheetLayout } from "@dnd-manager/game-ui/character-sheet-layout"
import { CharacterSheetHeader } from "@dnd-manager/game-ui/character-sheet-header"
import { CharacterSheetStatGrid } from "@dnd-manager/game-ui/character-sheet-stat-grid"
import { sendCharacterSheetOperation } from "@dnd-manager/session-client/character-sheet-operations"
import "./style.css"

const ASSOC_CHANNEL = "dnd-manager:owlbear-association-v1"
const ASSOC_POPOVER_ID = "com.dnd-manager.owlbear/character-selector"
const isAssociatePopover = new URLSearchParams(window.location.search).get("panel") === "associate"
const DICE_CHANNEL = "dnd-manager:owlbear-dice-v1"
const DICE_POPOVER_ID = "com.dnd-manager.owlbear/dice-popover"
const isDicePopover = new URLSearchParams(window.location.search).get("panel") === "dice"
const origin = (import.meta.env.VITE_DND_MANAGER_URL || "https://dnd-magic-manager.vercel.app").replace(/\/$/, "")
type Session = { id: string; name: string; role: "MASTER" | "PLAYER" }
type RuntimeCharacter = { characterId: string; ownerUserId?: string; active?: boolean; character?: Record<string, unknown> }
type RuntimeHp = { characterId: string; current: number; max: number; temporary: number; currentMax: number; attributes?: Record<string, number>; hitDice?: Record<string, {current: number; max: number}>; stats?: { exhaustion?: number; inspiration?: boolean; initiativeAdjustment?: number; armorClassAdjustment?: number } }
type AbilityState = { characterId: string; character: Record<string, unknown> }
const asRecord = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
const numeric = (value: unknown): string => typeof value === "number" && Number.isFinite(value) ? String(value) : "—"
function App() {
 const [ready, setReady] = useState(false)
 const [connected, setConnected] = useState(false)
 const [sessions, setSessions] = useState<Session[]>([])
 const [sessionId, setSessionId] = useState("")
 const [role, setRole] = useState("")
 const [status, setStatus] = useState("Desconectado")
 const [characters, setCharacters] = useState<Record<string, RuntimeCharacter>>({})
 const [abilities, setAbilities] = useState<Record<string, AbilityState>>({})
 const [hp, setHp] = useState<Record<string, RuntimeHp>>({})
 const [conditions, setConditions] = useState<Record<string, Record<string, unknown>>>({})
 const [runtimeConfig, setRuntimeConfig] = useState<Record<string, unknown> | null>(null)
 const [spellLibrary, setSpellLibrary] = useState<Record<string, unknown>[]>([])
 const [inventoryState, setInventoryState] = useState<Record<string, unknown> | null>(null)
 const [selectedId, setSelectedId] = useState("")
 const [associationState, setAssociationState] = useState<{sessionId:string;connected:boolean;characters:{id:string;name:string}[];role?:string;creatures?:{id:string;name:string;hp?:number;maxHp?:number;armorClass?:number}[];catalog?:{id:string;name:string}[]}>({sessionId:"",connected:false,characters:[],creatures:[],catalog:[]})
 const [associationChoice,setAssociationChoice] = useState("")
 const [associationKind,setAssociationKind] = useState<"character"|"creature"|"catalog">("character")
 const [associationError,setAssociationError] = useState("")
 const [associationBusy,setAssociationBusy] = useState(false)
 const assocChannel = useRef<BroadcastChannel|null>(null)
 const associationSnapshot = useRef({sessionId:"",connected:false,characters:[] as {id:string;name:string}[],role:"",catalog:[] as {id:string;name:string}[],creatures:[] as {id:string;name:string;hp?:number;maxHp?:number;armorClass?:number}[]})
 const [compendiumCreatures,setCompendiumCreatures] = useState<CompendiumCreature[]>([])
 const [pendingCreatureAdd,setPendingCreatureAdd] = useState<{tokenId:string;entryId:string;sessionId:string}|null>(null)
 const [initiativeState,setInitiativeState] = useState<Record<string,unknown>|null>(null)
 const [selectedToken, setSelectedToken] = useState<{id:string;name:string;link:{sessionId:string;characterId:string}|null;creatureLink:{sessionId:string;entryId:string}|null;catalogId:string|null;catalogSessionId:string|null}|null>(null)
 const [tokenLinkError, setTokenLinkError] = useState("")
 const [activeArea, setActiveArea] = useState<"sheet" | "dice">(isDicePopover ? "dice" : "sheet")
 const [rollHistory, setRollHistory] = useState<DiceHistoryEntry[]>([])
 const [sharedDice, setSharedDice] = useState<{connected:boolean; selectedCharacterId?:string; history:DiceHistoryEntry[]}>({connected:false,history:[]})
 const diceChannel = useRef<BroadcastChannel | null>(null)
 const currentDiceState = useRef({connected:false,selectedCharacterId:undefined as string|undefined,history:[] as DiceHistoryEntry[]})
 const popoverOpening = useRef(false)
 const openDicePopover = useCallback(async () => {
   if(isDicePopover || popoverOpening.current)return
   popoverOpening.current=true
   try {
     await OBR.popover.open({
       id: DICE_POPOVER_ID,
       url: "/?panel=dice",
       width: 440,
       height: 590,
       anchorReference: "POSITION",
       anchorPosition: {left: window.screen.availWidth - 16, top: window.screen.availHeight - 16},
       anchorOrigin: {horizontal: "RIGHT", vertical: "BOTTOM"},
       transformOrigin: {horizontal: "RIGHT", vertical: "BOTTOM"},
       disableClickAway: true,
     })
   } catch (error) { setError("Não foi possível abrir o rolador separado: " + String(error)) }
   finally { popoverOpening.current=false }
 }, [])
 useEffect(() => {
   const channel = new BroadcastChannel(DICE_CHANNEL)
   diceChannel.current = channel
   if(isDicePopover) channel.postMessage({type:"request-state"})
   channel.onmessage = event => {
     const message=event.data as Record<string,unknown>
     if(isDicePopover){
       if(message.type==="state")setSharedDice(message.value as typeof sharedDice)
       if(message.type==="result"){
         const entry=message.entry as DiceHistoryEntry
         if(entry?.result?.id)setSharedDice(prev=>({...prev,history:prev.history.some(v=>v.result.id===entry.result.id)?prev.history:[entry,...prev.history].slice(0,60)}))
       }
     }else{
       if(message.type==="request-state")channel.postMessage({type:"state",value:currentDiceState.current})
       if(message.type==="roll" && message.request && socket.current)socket.current.sendRaw(JSON.stringify({type:"session.dice.roll",request:message.request}))
     }
   }
   return ()=>{channel.close();if(diceChannel.current===channel)diceChannel.current=null}
 }, [])
 useEffect(()=>{
   if(isDicePopover)return
   currentDiceState.current={connected:status==="Conectado à sessão",selectedCharacterId:selectedId||undefined,history:rollHistory}
   diceChannel.current?.postMessage({type:"state",value:currentDiceState.current})
 },[status,selectedId,rollHistory])
 const [sheetMode, setSheetMode] = useState<"play" | "configuration">("play")
 const [error, setError] = useState("")
 const grant = useRef<string | null>(null)
 const socket = useRef<SessionTransport | null>(null)
 useEffect(() => { let active = true; OBR.onReady(() => { if (active) setReady(true) }); return () => { active = false } }, [])
 useEffect(() => {
   if (!ready || isDicePopover || isAssociatePopover) return
   const id = "com.dnd-manager.owlbear/associate-character"
   void OBR.contextMenu.create({
     id,
     icons: [{
       icon: "/icon.svg",
       label: "D&D Manager · Associar ficha ao token",
       filter: { min: 1, max: 1, every: [{key: "type", value: "IMAGE"}] },
     }],
     onClick(context) {
       const token = context.items[0]
       if (!token) return
       setSelectedToken({
         id: token.id, name: token.name,
         link: readTokenCharacterLink(token.metadata),creatureLink:readTokenCreatureLink(token.metadata),catalogId:String(readTokenCompendiumCreature(token.metadata)?.creatureId??"")||null,catalogSessionId:String(readTokenCompendiumCreature(token.metadata)?.sessionId??"")||null,
       })
       void OBR.popover.open({
         id: ASSOC_POPOVER_ID,
         url: "/?panel=associate&tokenId=" + encodeURIComponent(token.id),
         width: 360, height: 340,
         anchorReference: "ELEMENT", anchorOrigin: {horizontal:"RIGHT",vertical:"TOP"},
         transformOrigin: {horizontal:"RIGHT",vertical:"TOP"},
         disableClickAway: true,
       }).catch(error=>setTokenLinkError(String(error)))
     },
   })
   return () => { void OBR.contextMenu.remove(id) }
 }, [ready])
 useEffect(() => {
   if (!ready || isDicePopover) return
   let active = true
   const update = async () => {
     try {
       const token = await readSelectedToken()
       if (!active) return
       setSelectedToken(token ? {id:token.id,name:token.name,link:readTokenCharacterLink(token.metadata),creatureLink:readTokenCreatureLink(token.metadata),catalogId:String(readTokenCompendiumCreature(token.metadata)?.creatureId??"")||null,catalogSessionId:String(readTokenCompendiumCreature(token.metadata)?.sessionId??"")||null} : null)
     } catch (e) { if (active) setTokenLinkError(String(e)) }
   }
   void update()
   const stop = OBR.player.onChange(() => void update())
   const stopItems = OBR.scene.items.onChange(() => void update())
   return () => { active = false;stop();stopItems() }
 }, [ready])
 useEffect(() => {
   if (!sessionId || !selectedToken?.link || selectedToken.link.sessionId !== sessionId) return
   const linkedId = selectedToken.link.characterId
   if (characters[linkedId]?.active !== false && (characters[linkedId]?.character || abilities[linkedId]))
     setSelectedId(linkedId)
 }, [sessionId,selectedToken?.id,selectedToken?.link?.characterId,selectedToken?.link?.sessionId,characters,abilities])
 const saveTokenLink = useCallback(async (remove = false) => {
   if (!selectedToken || !sessionId) return
   if (!remove && !selectedId) return
   try {
     setTokenLinkError("")
     await setTokenCharacterLink(selectedToken.id, remove ? null : {sessionId,characterId:selectedId})
     setSelectedToken(prev => prev?.id===selectedToken.id ? {...prev,link: remove ? null : {sessionId,characterId:selectedId},creatureLink:null} : prev)
   } catch (e) {setTokenLinkError("Não foi possível alterar o vínculo: " + String(e))}
 },[selectedToken,sessionId,selectedId])
 useEffect(()=>{
   if(isDicePopover)return
   const channel=new BroadcastChannel(ASSOC_CHANNEL)
   assocChannel.current=channel
   if(isAssociatePopover)channel.postMessage({type:"request-state"})
   channel.onmessage=event=>{
     const message=event.data as Record<string,unknown>
     if(isAssociatePopover){
       if(message.type==="state"){
         const state=message.value as typeof associationState
         setAssociationState(state)
       }
     } else if(message.type==="request-state") {
       channel.postMessage({type:"state",value:associationSnapshot.current})
     }
   }
   return()=>{channel.close();if(assocChannel.current===channel)assocChannel.current=null}
 },[])
 useEffect(()=>{
   if(isDicePopover||isAssociatePopover)return
   associationSnapshot.current={
     sessionId,connected:status==="Conectado à sessão",role,
     catalog:role==="MASTER"?compendiumCreatures.map(c=>({id:c.id,name:c.name})):[],
     creatures:role==="MASTER"? (Array.isArray(asRecord(initiativeState?.session).entries)? asRecord(initiativeState?.session).entries as Record<string,unknown>[]:[])
       .filter(entry=>entry.sourceType==="monster"||entry.sourceType==="npc"||entry.sourceType==="custom")
       .map(entry=>({id:String(entry.id),name:String(entry.customName??entry.realName??entry.name),hp:typeof entry.currentHp==="number"?entry.currentHp:undefined,maxHp:typeof entry.maxHp==="number"?entry.maxHp:undefined,armorClass:typeof entry.armorClass==="number"?entry.armorClass:undefined})) : [],
     characters:Object.values(characters)
       .filter(c=>c.active!==false&&(c.character||abilities[c.characterId]))
       .map(c=>({id:c.characterId,name:String(asRecord(abilities[c.characterId]?.character??c.character).name??c.characterId)})),
   }
   assocChannel.current?.postMessage({type:"state",value:associationSnapshot.current})
 },[sessionId,status,role,initiativeState,compendiumCreatures,characters,abilities])
 const associationTokenId=new URLSearchParams(window.location.search).get("tokenId")??""
 const submitAssociation=useCallback(async(remove:boolean)=>{
   if(!associationTokenId||!associationState.connected||!associationState.sessionId)return
   if(!remove&&!(associationKind==="creature"&&associationState.role==="MASTER"?associationState.creatures?.some(c=>c.id===associationChoice):associationKind==="catalog"&&associationState.role==="MASTER"?associationState.catalog?.some(c=>c.id===associationChoice):associationState.characters.some(c=>c.id===associationChoice)))return
   setAssociationBusy(true);setAssociationError("")
   try{
     if(remove){ await OBR.scene.items.updateItems([associationTokenId],items=>{for(const item of items){item.metadata["com.dnd-manager.owlbear/creature-link"]=null;item.metadata["com.dnd-manager.owlbear/character-link"]=null;item.metadata[TOKEN_COMPENDIUM_CREATURE_METADATA]=null}}) }
     else if(associationKind==="catalog")await OBR.scene.items.updateItems([associationTokenId],items=>{for(const item of items){item.metadata[TOKEN_COMPENDIUM_CREATURE_METADATA]={sessionId:associationState.sessionId,creatureId:associationChoice};item.metadata["com.dnd-manager.owlbear/creature-link"]=null;item.metadata["com.dnd-manager.owlbear/character-link"]=null}})
     else if(associationKind==="creature")await setTokenCreatureLink(associationTokenId,{sessionId:associationState.sessionId,entryId:associationChoice})
     else {await setTokenCharacterLink(associationTokenId,{sessionId:associationState.sessionId,characterId:associationChoice});await setTokenCreatureLink(associationTokenId,null)}
     await OBR.popover.close(ASSOC_POPOVER_ID)
   }catch(error){setAssociationError(String(error))}
   finally{setAssociationBusy(false)}
 },[associationTokenId,associationState,associationChoice,associationKind])
 const disconnect = useCallback(() => {
   socket.current?.disconnect()
   socket.current = null
   setCharacters({}); setAbilities({}); setHp({}); setConditions({}); setRuntimeConfig(null); setSpellLibrary([]); setInventoryState(null);setInitiativeState(null);setCompendiumCreatures([]); setSelectedId(""); setRollHistory([]); setStatus("Desconectado")
 }, [])
 useEffect(() => () => { socket.current?.disconnect() }, [])
 const api = useCallback(async <T,>(path: string): Promise<T> => {
   if (!grant.current) throw new Error("Conecte sua conta primeiro.")
   const response = await fetch(origin + "/api/owlbear" + path, { credentials: "omit", headers: { Authorization: "Bearer " + grant.current, Accept: "application/json" } })
   if (!response.ok) throw new Error(response.status === 401 ? "Autorização expirada. Reconecte sua conta." : "Erro da API: HTTP " + response.status)
   return response.json() as Promise<T>
 }, [])
 const refreshSessions = useCallback(async () => {
   setError("")
   try {
     const result = await api<{ sessions: Session[] }>("?op=sessions")
     setSessions(result.sessions)
   } catch (e) { setError(String(e instanceof Error ? e.message : e)) }
 }, [api])
 const connectAccount = useCallback(() => {
   const nonce = crypto.randomUUID()
   const popup = window.open(origin + "/owlbear-connect.html?origin=" + encodeURIComponent(location.origin) + "&nonce=" + nonce, "dnd-owlbear-connect", "width=530,height=630")
   if (!popup) { setError("Permita a janela de autorização no navegador."); return }
   const timeout = setTimeout(() => { window.removeEventListener("message", receive); setError("Autorização expirada.") }, 120000)
   function receive(event: MessageEvent) {
     if (event.origin !== origin || event.source !== popup || event.data?.type !== "dnd-manager:owlbear-grant" || event.data.nonce !== nonce || typeof event.data.token !== "string") return
     clearTimeout(timeout); window.removeEventListener("message", receive)
     grant.current = event.data.token
     setConnected(true); setError("")
     void (async () => {
       try { const result = await api<{sessions: Session[]}>("?op=sessions"); setSessions(result.sessions) }
       catch (e) { setError(String(e instanceof Error ? e.message : e)) }
     })()
   }
   window.addEventListener("message", receive)
 }, [api])
 const connectSession = useCallback(async (id: string) => {
   disconnect(); setSessionId(id); if (!id) return
   setStatus("Autorizando sessão..."); setError("")
   try {
     const result = await api<{ token: string; baseUrl: string; role: string; clientId: string }>("?op=connect&sessionId=" + encodeURIComponent(id))
     setRole(result.role)
     if(result.role==="MASTER")void api<{creatures:CompendiumCreature[]}>("?op=creature-compendium&sessionId="+encodeURIComponent(id)).then(data=>setCompendiumCreatures(Array.isArray(data.creatures)?data.creatures:[])).catch(error=>setError("Compêndio indisponível: "+String(error)))
     void api<{spells:Record<string,unknown>[]}>("?op=homebrew-spells&sessionId="+encodeURIComponent(id))
       .then(data=>setSpellLibrary(Array.isArray(data.spells)?data.spells:[]))
       .catch(error=>console.warn("[owlbear] homebrew spell library unavailable",error))
     let firstToken:string|null = result.token
     const ws = new SessionTransport({
       baseUrl:result.baseUrl, sessionId:id, userId:"", role:result.role === "MASTER" ? "MASTER" : "PLAYER",
       clientId:result.clientId, useTokenAuth:true, tokenEndpoint:"",
       onKicked:()=>{setError("Acesso à sessão revogado.");disconnect()},
       onStatusChange:state=>{
         if(socket.current !== ws)return
         if(state === "reconnecting" || state === "error" || state === "disconnected") {
           setCharacters({}); setAbilities({}); setHp({}); setConditions({}); setInventoryState(null); setRuntimeConfig(null)
         }
         setStatus(state === "connected" ? "Conectado à sessão"
           : state === "reconnecting" ? "Reconectando à sessão..."
           : state === "error" ? "Erro de conexão; tentando novamente..."
           : state === "connecting" ? "Aguardando sincronização..."
           : "Desconectado")
       },
       getConnectionToken:async()=>{
         if(firstToken){const value=firstToken;firstToken=null;return value}
         const renewed=await api<{token:string}>("?op=connect&sessionId="+encodeURIComponent(id)+"&clientId="+encodeURIComponent(result.clientId))
         return renewed.token
       },
       onMessage:rawMessage=>{
         if(socket.current !== ws)return
         const event = {data:rawMessage}

       if (socket.current !== ws) return
       let message: Record<string, unknown>
       try { message = JSON.parse(event.data) as Record<string, unknown> } catch { return }
       const entries = Array.isArray(message.characters) ? message.characters : []
       const character = asRecord(message.character)
       if (message.type === "session.dice.result") {
         if(!isDicePopover){void openDicePopover();diceChannel.current?.postMessage({type:"result",entry:{kind:"dice",result:message.result}})}
         publishServerDiceRoll(message.result as Parameters<typeof publishServerDiceRoll>[0])
         const result = message.result as DiceHistoryEntry["result"]
         if (result && typeof result.id === "string") setRollHistory(previous => previous.some(entry=>entry.result.id===result.id)?previous:[{kind:"dice" as const,result:result as Extract<DiceHistoryEntry,{kind:"dice"}>["result"]},...previous].slice(0,60))
       }
       if (message.type === "session.action.result") {
         if(!isDicePopover){void openDicePopover();diceChannel.current?.postMessage({type:"result",entry:{kind:"action",result:message.result}})}
         publishServerActionRoll(message.result as Parameters<typeof publishServerActionRoll>[0])
         const result = message.result as DiceHistoryEntry["result"]
         if (result && typeof result.id === "string") setRollHistory(previous => previous.some(entry=>entry.result.id===result.id)?previous:[{kind:"action" as const,result:result as Extract<DiceHistoryEntry,{kind:"action"}>["result"]},...previous].slice(0,60))
       }
       if (message.type === "session.error") setError(String(message.message ?? "Erro na sessão."))
       if (message.type === "session.ready") {
         setError("")
         setStatus("Conectado à sessão")
         // SessionTransport owns authenticated heartbeats and reconnection.
       }
       if (message.type === "session.characters.snapshot") setCharacters(Object.fromEntries(entries.map((v: unknown) => { const c = v as RuntimeCharacter; return [c.characterId, c] })))
       if (message.type === "session.character.updated") setCharacters(previous => ({ ...previous, [String(character.characterId)]: character as RuntimeCharacter }))
       if (message.type === "session.character.removed") setCharacters(previous => { const copy = { ...previous }; delete copy[String(message.characterId)]; return copy })
       if (message.type === "session.abilities.snapshot") setAbilities(Object.fromEntries(entries.map((v: unknown) => { const c = v as AbilityState; return [c.characterId, c] })))
       if (message.type === "session.abilities.updated") setAbilities(previous => ({ ...previous, [String(character.characterId)]: character as AbilityState }))
       if (message.type === "session.initiative.snapshot" || message.type === "session.initiative.updated")setInitiativeState(asRecord(message.state))
       if (message.type === "session.inventory.snapshot" || message.type === "session.inventory.updated") setInventoryState(asRecord(message.state))
       if (message.type === "session.config.snapshot") setRuntimeConfig(asRecord(message.snapshot))
       if (message.type === "session.conditions.snapshot") setConditions(Object.fromEntries(entries.map((v: unknown) => { const c = v as {characterId: string}; return [c.characterId, asRecord(c)] })))
       if (message.type === "session.conditions.updated") setConditions(previous => ({...previous,[String(character.characterId)]:character}))
       if (message.type === "session.hp.snapshot") setHp(Object.fromEntries(entries.map((v: unknown) => { const c = v as RuntimeHp; return [c.characterId, c] })))
       if (message.type === "session.hp.updated") setHp(previous => ({ ...previous, [String(character.characterId)]: character as RuntimeHp }))
       }
     })
     socket.current=ws
     ws.connect()
   } catch (e) { setStatus("Desconectado"); setError(String(e instanceof Error ? e.message : e)) }
 }, [api, disconnect, openDicePopover])
 const initiativeEntries=(Array.isArray(asRecord(initiativeState?.session).entries)
  ? asRecord(initiativeState?.session).entries : []) as InitiativeEntry[]
 const boundCreature=role==="MASTER" && selectedToken?.creatureLink?.sessionId===sessionId
  ? initiativeEntries.find(entry=>entry.id===selectedToken.creatureLink?.entryId) : undefined
 const catalogCreature=role==="MASTER"&&selectedToken?.catalogSessionId===sessionId&&selectedToken?.catalogId?compendiumCreatures.find(c=>c.id===selectedToken.catalogId):undefined
 const addCatalogToInitiative=()=>{
   if(!catalogCreature||status!=="Conectado à sessão"||role!=="MASTER"||!selectedToken||pendingCreatureAdd)return
   const entryId=crypto.randomUUID()
   const entry={id:entryId,sourceId:catalogCreature.id,sourceType:"monster",name:catalogCreature.name,basicName:catalogCreature.basicName,realName:catalogCreature.name,initiative:0,initiativeBonus:catalogCreature.initiativeBonus,side:catalogCreature.defaultSide,armorClass:catalogCreature.armorClass,maxHp:catalogCreature.maxHp,currentHp:catalogCreature.maxHp,temporaryHp:0,conditions:[],order:initiativeEntries.length,createdAt:Date.now(),hidden:false,defeated:false}
   if(socket.current?.sendRaw(JSON.stringify({type:"session.initiative.operation",operation:{type:"initiative.entries.add",characterId:"session",entries:[entry]}})))setPendingCreatureAdd({tokenId:selectedToken.id,entryId,sessionId})
   else setError("Não foi possível enviar a criatura à iniciativa.")
 }
 useEffect(()=>{
   if(!pendingCreatureAdd||pendingCreatureAdd.sessionId!==sessionId)return
   const entries=Array.isArray(asRecord(initiativeState?.session).entries)?asRecord(initiativeState?.session).entries as Record<string,unknown>[]:[]
   if(!entries.some(entry=>entry.id===pendingCreatureAdd.entryId))return
   void setTokenCreatureLink(pendingCreatureAdd.tokenId,{sessionId,entryId:pendingCreatureAdd.entryId})
     .then(()=>setPendingCreatureAdd(null))
     .catch(error=>{setError("Criatura adicionada, mas token não foi vinculado: "+String(error));setPendingCreatureAdd(null)})
 },[pendingCreatureAdd,sessionId,initiativeState])
 const list = Object.values(characters).filter(c => c.active !== false && (c.character || abilities[c.characterId]))
 const chosen = characters[selectedId]
 const raw = asRecord(abilities[selectedId]?.character ?? chosen?.character)
 const sheet = asRecord(raw.sheet)
 const health = hp[selectedId]
 const attributes = asRecord(sheet.attributes)
 if(isAssociatePopover)return <main className="owlbear-shell">
   <section className="grid gap-3 p-4">
     <div className="flex items-center justify-between gap-2">
       <h2 className="text-sm font-semibold text-textH">Associar ficha ao token</h2>
       <button type="button" onClick={()=>void OBR.popover.close(ASSOC_POPOVER_ID)} className="rounded border border-border px-2 py-1 text-xs">Fechar</button>
     </div>
     {!associationState.connected?<p className="text-xs text-textMuted">Abra e conecte o painel principal do D&D Manager à sessão para associar um personagem.</p>:<>
       {associationState.role==="MASTER"&&<div className="flex gap-2"><button type="button" onClick={()=>{setAssociationKind("character");setAssociationChoice("")}} className={"rounded px-3 py-2 text-xs "+(associationKind==="character"?"bg-accentBg":"border border-border")}>Personagem</button><button type="button" onClick={()=>{setAssociationKind("creature");setAssociationChoice("")}} className={"rounded px-3 py-2 text-xs "+(associationKind==="creature"?"bg-accentBg":"border border-border")}>Criatura na iniciativa</button><button type="button" onClick={()=>{setAssociationKind("catalog");setAssociationChoice("")}} className={"rounded px-3 py-2 text-xs "+(associationKind==="catalog"?"bg-accentBg":"border border-border")}>Compêndio</button></div>}
       <label className="grid gap-2 text-xs text-textH">{associationKind==="creature"?"Instância da criatura":associationKind==="catalog"?"Criatura do compêndio":"Personagem da sessão"}
         <select className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2" value={associationChoice}
           onChange={event=>setAssociationChoice(event.target.value)}>
           <option value="">Selecione...</option>
           {(associationKind==="creature"?(associationState.creatures??[]):associationKind==="catalog"?(associationState.catalog??[]):associationState.characters).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
         </select>
       </label>
       <button type="button" disabled={!associationChoice||associationBusy} onClick={()=>void submitAssociation(false)}
         className="rounded-lg bg-accentBg px-3 py-2 text-xs font-semibold text-textH disabled:opacity-40">Associar {associationKind==="character"?"personagem":"criatura"}</button>
       <button type="button" disabled={associationBusy} onClick={()=>void submitAssociation(true)}
         className="rounded-lg border border-border px-3 py-2 text-xs text-textH">Desassociar token</button>
     </>}
     {associationError&&<p role="alert" className="text-xs text-danger">{associationError}</p>}
   </section>
 </main>
 if(isDicePopover)return <main className="owlbear-shell">
   <div className="flex items-center justify-between border-b border-border bg-bg px-3 py-2">
     <strong className="text-sm text-textH">Rolador de dados</strong>
     <button type="button" onClick={()=>void OBR.popover.close(DICE_POPOVER_ID)} aria-label="Fechar rolador"
       className="rounded-lg border border-border px-3 py-1 text-sm text-textH">Fechar ✕</button>
   </div>
   <SessionDicePanel connected={sharedDice.connected} selectedCharacterId={sharedDice.selectedCharacterId}
     history={sharedDice.history} onRoll={request=>{
       if(!sharedDice.connected)return false
       diceChannel.current?.postMessage({type:"roll",request})
       return diceChannel.current!==null
     }}/>
 </main>
 return <main className="owlbear-shell">
 <header><strong>{isDicePopover ? "D&D Manager · Dados" : "D&D Manager"}</strong><span>{ready ? "Owlbear conectado" : "Pré-visualização"}</span></header>
 <section>{!isDicePopover && <><h1>D&D Manager · Sessão</h1><p>Ficha e rolagens sincronizadas com o Session Server.</p></>}
 <div className="toolbar"><button onClick={connectAccount}>{connected ? "Reconectar conta" : "Conectar ao D&D Manager"}</button><button disabled={!connected} onClick={() => void refreshSessions()}>Atualizar sessões</button></div>
 {error && <p role="alert" className="error">{error}</p>}
 <label className="field">Campanha / sessão<select value={sessionId} disabled={!connected} onChange={e => void connectSession(e.target.value)}><option value="">Selecione uma sessão...</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role === "MASTER" ? "Mestre" : "Jogador"})</option>)}</select></label>
 <p>{status}{sessionId && role ? " · " + (role === "MASTER" ? "Mestre" : "Jogador") : ""}</p>
 <label className="field">Personagem da sessão<select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Selecione um personagem...</option>{list.map(c => <option key={c.characterId} value={c.characterId}>{String(asRecord(abilities[c.characterId]?.character ?? c.character).name ?? c.characterId)}</option>)}</select></label>
 {!isDicePopover && selectedToken && <div className="mb-3 grid gap-2 rounded-xl border border-border bg-bg p-3 text-xs">
   <strong className="text-textH">Token selecionado: {selectedToken.name || "Sem nome"}</strong>
   <span className="text-textMuted">{selectedToken.link?.sessionId===sessionId
     ? "Associado a: " + String(asRecord(abilities[selectedToken.link.characterId]?.character ?? characters[selectedToken.link.characterId]?.character).name ?? selectedToken.link.characterId)
     : selectedToken.link ? "Associado a outra sessão" : "Nenhuma ficha associada"}</span>
   <div className="flex flex-wrap gap-2">
     <button type="button" disabled={!selectedId || status!=="Conectado à sessão"} onClick={()=>void saveTokenLink()}
       className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 font-semibold text-textH disabled:opacity-40">{selectedToken.link?"Trocar associação":"Associar ficha selecionada"}</button>
     {selectedToken.link && <button type="button" onClick={()=>void saveTokenLink(true)}
       className="rounded-lg border border-border px-3 py-2 text-textH">Desassociar</button>}
   </div>
   {tokenLinkError && <p role="alert" className="text-danger">{tokenLinkError}</p>}
 </div>}
 {!isDicePopover && <button type="button" className="mb-3 inline-flex items-center gap-2 rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH" onClick={()=>void openDicePopover()}>Abrir rolador separado ↗</button>}
 {!isDicePopover && <div className="mb-3 flex gap-2 rounded-xl border border-border bg-bg p-1" role="tablist" aria-label="Ferramentas da sessão">
 <button type="button" role="tab" aria-selected={activeArea==="sheet"} onClick={()=>setActiveArea("sheet")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeArea==="sheet"?"bg-accentBg text-textH":"text-textMuted hover:bg-bg-subtle"}`}>Ficha</button>
 <button type="button" role="tab" aria-selected={activeArea==="dice"} onClick={()=>setActiveArea("dice")} className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${activeArea==="dice"?"bg-accentBg text-textH":"text-textMuted hover:bg-bg-subtle"}`}>Dados</button>
 </div>}
 <div role="tabpanel" hidden={activeArea!=="dice"}><SessionDicePanel connected={status==="Conectado à sessão"} selectedCharacterId={selectedId || undefined} history={rollHistory} onRoll={request=>socket.current?.sendRaw(JSON.stringify({type:"session.dice.roll",request}))??false}/></div>
 {!isDicePopover && <div role="tabpanel" hidden={activeArea!=="sheet"}>
 {catalogCreature && !boundCreature ? <div className="grid gap-3"><CreatureQuickSheet data={quickSheetFromCompendiumCreature(catalogCreature)} compact/><button type="button" disabled={Boolean(pendingCreatureAdd)} onClick={addCatalogToInitiative} className="rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm font-semibold disabled:opacity-40">{pendingCreatureAdd?"Aguardando confirmação...":"Adicionar à iniciativa"}</button></div> : boundCreature ? <CreatureTokenInspector key={boundCreature.id} entry={boundCreature} connected={status==="Conectado à sessão"} onOperation={operation=>socket.current?.sendRaw(JSON.stringify({type:"session.initiative.operation",operation}))??false}/> : selectedId && chosen && <article className="character-panel">
 <CharacterSheetHeader name={String(raw.name ?? selectedId)} id={selectedId} />
 <NativeCharacterSheetHost
   characterId={selectedId} raw={raw} hp={health as unknown as Record<string, unknown>} conditions={conditions[selectedId]} runtimeConfig={runtimeConfig} inventoryState={inventoryState} spells={spellLibrary} role={role === "MASTER" ? "MASTER" : "PLAYER"}
   sessionId={sessionId} connected={status === "Conectado à sessão"}
   send={message => socket.current?.sendRaw(JSON.stringify(message)) ?? false}
 />
 </article>}
 </div>}
 </section><footer>O Durable Object é a fonte de verdade. O servidor da sessão determina quais personagens cada usuário pode receber.</footer>
 </main>
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>)
