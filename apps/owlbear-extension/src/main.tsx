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
 const [selectedId, setSelectedId] = useState("")
 const [sheetMode, setSheetMode] = useState<"play" | "configuration">("play")
 const [error, setError] = useState("")
 const grant = useRef<string | null>(null)
 const socket = useRef<WebSocket | null>(null)
 const heartbeat = useRef<ReturnType<typeof setInterval> | null>(null)
 useEffect(() => { let active = true; OBR.onReady(() => { if (active) setReady(true) }); return () => { active = false } }, [])
 const disconnect = useCallback(() => {
   if (heartbeat.current) clearInterval(heartbeat.current)
   heartbeat.current = null
   socket.current?.close(1000, "Leaving session")
   socket.current = null
   setCharacters({}); setAbilities({}); setHp({}); setConditions({}); setRuntimeConfig(null); setSpellLibrary([]); setSelectedId(""); setStatus("Desconectado")
 }, [])
 useEffect(() => () => { socket.current?.close(); if (heartbeat.current) clearInterval(heartbeat.current) }, [])
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
     void api<{spells:Record<string,unknown>[]}>("?op=homebrew-spells&sessionId="+encodeURIComponent(id))
       .then(data=>setSpellLibrary(Array.isArray(data.spells)?data.spells:[]))
       .catch(error=>console.warn("[owlbear] homebrew spell library unavailable",error))
     const url = new URL(result.baseUrl)
     url.protocol = url.protocol === "https:" ? "wss:" : "ws:"
     url.pathname = "/session/" + encodeURIComponent(id) + "/connect"
     url.search = ""; url.searchParams.set("token", result.token)
     const ws = new WebSocket(url)
     socket.current = ws
     ws.onopen = () => { if (socket.current === ws) setStatus("Aguardando sincronização...") }
     ws.onmessage = event => {
       if (socket.current !== ws) return
       let message: Record<string, unknown>
       try { message = JSON.parse(event.data) as Record<string, unknown> } catch { return }
       const entries = Array.isArray(message.characters) ? message.characters : []
       const character = asRecord(message.character)
       if (message.type === "session.dice.result") publishServerDiceRoll(message.result as Parameters<typeof publishServerDiceRoll>[0])
       if (message.type === "session.action.result") publishServerActionRoll(message.result as Parameters<typeof publishServerActionRoll>[0])
       if (message.type === "session.error") setError(String(message.message ?? "Erro na sessão."))
       if (message.type === "session.ready") {
         setStatus("Conectado à sessão")
         heartbeat.current = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "session.heartbeat", clientId: result.clientId })) }, 30000)
       }
       if (message.type === "session.characters.snapshot") setCharacters(Object.fromEntries(entries.map((v: unknown) => { const c = v as RuntimeCharacter; return [c.characterId, c] })))
       if (message.type === "session.character.updated") setCharacters(previous => ({ ...previous, [String(character.characterId)]: character as RuntimeCharacter }))
       if (message.type === "session.character.removed") setCharacters(previous => { const copy = { ...previous }; delete copy[String(message.characterId)]; return copy })
       if (message.type === "session.abilities.snapshot") setAbilities(Object.fromEntries(entries.map((v: unknown) => { const c = v as AbilityState; return [c.characterId, c] })))
       if (message.type === "session.abilities.updated") setAbilities(previous => ({ ...previous, [String(character.characterId)]: character as AbilityState }))
       if (message.type === "session.config.snapshot") setRuntimeConfig(asRecord(message.snapshot))
       if (message.type === "session.conditions.snapshot") setConditions(Object.fromEntries(entries.map((v: unknown) => { const c = v as {characterId: string}; return [c.characterId, asRecord(c)] })))
       if (message.type === "session.conditions.updated") setConditions(previous => ({...previous,[String(character.characterId)]:character}))
       if (message.type === "session.hp.snapshot") setHp(Object.fromEntries(entries.map((v: unknown) => { const c = v as RuntimeHp; return [c.characterId, c] })))
       if (message.type === "session.hp.updated") setHp(previous => ({ ...previous, [String(character.characterId)]: character as RuntimeHp }))
     }
     ws.onclose = () => { if (socket.current === ws) { setStatus("Sessão desconectada; reconecte para atualizar."); if (heartbeat.current) clearInterval(heartbeat.current) } }
     ws.onerror = () => { if (socket.current === ws) setError("Falha na conexão com o servidor da sessão.") }
   } catch (e) { setStatus("Desconectado"); setError(String(e instanceof Error ? e.message : e)) }
 }, [api, disconnect])
 const list = Object.values(characters).filter(c => c.active !== false && (c.character || abilities[c.characterId]))
 const chosen = characters[selectedId]
 const raw = asRecord(abilities[selectedId]?.character ?? chosen?.character)
 const sheet = asRecord(raw.sheet)
 const health = hp[selectedId]
 const sendHp = (type: "character.hp.heal" | "character.hp.damage", amount: number) => {
   if (!selectedId || socket.current?.readyState !== WebSocket.OPEN) { setError("Sessão desconectada."); return }
   sendCharacterSheetOperation(socket.current, { type, characterId: selectedId, amount })
 }
 const attributes = asRecord(sheet.attributes)
 return <main>
 <header><strong>D&D Manager</strong><span>{ready ? "Owlbear conectado" : "Pré-visualização"}</span></header>
 <section><h1>Ficha da sessão</h1><p>Estado em tempo real do Session Server. A lista e as permissões são determinadas pelo servidor, não pelos personagens persistidos.</p>
 <div className="toolbar"><button onClick={connectAccount}>{connected ? "Reconectar conta" : "Conectar ao D&D Manager"}</button><button disabled={!connected} onClick={() => void refreshSessions()}>Atualizar sessões</button></div>
 {error && <p role="alert" className="error">{error}</p>}
 <label className="field">Campanha / sessão<select value={sessionId} disabled={!connected} onChange={e => void connectSession(e.target.value)}><option value="">Selecione uma sessão...</option>{sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role === "MASTER" ? "Mestre" : "Jogador"})</option>)}</select></label>
 <p>{status}{sessionId && role ? " · " + (role === "MASTER" ? "Mestre" : "Jogador") : ""}</p>
 <label className="field">Personagem da sessão<select value={selectedId} onChange={e => setSelectedId(e.target.value)}><option value="">Selecione um personagem...</option>{list.map(c => <option key={c.characterId} value={c.characterId}>{String(asRecord(abilities[c.characterId]?.character ?? c.character).name ?? c.characterId)}</option>)}</select></label>
 {selectedId && chosen && <article>
 <CharacterSheetHeader name={String(raw.name ?? selectedId)} id={selectedId} />
 <NativeCharacterSheetHost
   characterId={selectedId} raw={raw} hp={health as unknown as Record<string, unknown>} conditions={conditions[selectedId]} runtimeConfig={runtimeConfig} spells={spellLibrary} role={role === "MASTER" ? "MASTER" : "PLAYER"}
   sessionId={sessionId} connected={status === "Conectado à sessão"}
   send={message => { if (socket.current?.readyState !== WebSocket.OPEN) return false; socket.current.send(JSON.stringify(message)); return true }}
 />
 </article>}
 </section><footer>O Durable Object é a fonte de verdade. O servidor da sessão determina quais personagens cada usuário pode receber.</footer>
 </main>
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>)
