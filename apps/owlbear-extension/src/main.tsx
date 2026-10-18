import React, { useCallback, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import OBR from "@owlbear-rodeo/sdk"
import { CharacterSheetDerivedTile } from "@dnd-manager/game-ui/character-sheet-fields"
import "./style.css"

type Character = { id:string; name:string; revision?:number; data?:Record<string,unknown> }
const origin=(import.meta.env.VITE_DND_MANAGER_URL || "https://dnd-magic-manager.vercel.app").replace(/\/$/,"")
const profile=origin+"/user"
const number=(x:unknown)=>typeof x==="number"&&Number.isFinite(x)?x:undefined
const record=(x:unknown):Record<string,unknown>=>x&&typeof x==="object"&&!Array.isArray(x)?x as Record<string,unknown>:{}
async function api<T>(path:string,options:RequestInit={}):Promise<T>{
  const response=await fetch(origin+"/api"+path,{...options,credentials:"include",headers:{"Accept":"application/json","Content-Type":"application/json",...options.headers}})
  if(!response.ok)throw new Error(response.status===401||response.status===403?"Acesso negado. Entre no D&D Manager e verifique a política de cookies/CORS.":response.status===409?"Conflito de edição: atualize a ficha.":`Falha na API (HTTP ${response.status})`)
  return response.json() as Promise<T>
}
function App(){
 const [ready,setReady]=useState(false)
 const [list,setList]=useState<Character[]>([])
 const [chosen,setChosen]=useState("")
 const [current,setCurrent]=useState<Character|null>(null)
 const [name,setName]=useState("")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 useEffect(()=>{let active=true;OBR.onReady(()=>{if(active)setReady(true)});return()=>{active=false}},[])
 const refresh=useCallback(async()=>{setBusy(true);setError("");try{const response=await api<{characters:Character[]}>("/me/characters");setList(response.characters??[])}catch(e){setError(String(e instanceof Error?e.message:e))}finally{setBusy(false)}},[])
 useEffect(()=>{void refresh()},[refresh])
 const open=useCallback(async(id:string)=>{setChosen(id);setBusy(true);setError("");setNotice("");try{const data=await api<{character:Character}>("/me/characters/"+encodeURIComponent(id));setCurrent(data.character);setName(data.character.name)}catch(e){setError(String(e instanceof Error?e.message:e))}finally{setBusy(false)}},[])
 async function save(){if(!current)return;setBusy(true);setError("");try{const result=await api<{character:Character}>("/me/characters/"+encodeURIComponent(current.id),{method:"PATCH",body:JSON.stringify({name:name.trim(),expectedVersion:current.revision})});setCurrent(result.character);setName(result.character.name);setNotice("Nome salvo no D&D Manager.");await refresh()}catch(e){setError(String(e instanceof Error?e.message:e))}finally{setBusy(false)}}
 const sheet=record(current?.data?.sheet)
 const hp=record(sheet.hp)
 const stats=record(sheet.stats)
 return <main>
 <header><strong>D&D Manager</strong><span>{ready?"Owlbear conectado":"Pré-visualização"}</span></header>
 <section><h1>Fichas dos personagens</h1><p>Interface nativa da extensão. Os dados são consultados diretamente da API do D&D Manager; não existe cópia local nem iframe.</p>
 <div className="toolbar"><button onClick={()=>void refresh()} disabled={busy}>Atualizar lista</button><a href={profile} target="_blank" rel="noopener noreferrer">Entrar / abrir ficha completa ↗</a></div>
 {error&&<p role="alert" className="error">{error} Se necessário, utilize a ficha no site: o acesso cross-origin depende da configuração CORS e dos cookies do navegador.</p>}
 {notice&&<p role="status" className="notice">{notice}</p>}
 <label className="field">Personagem<select value={chosen} onChange={e=>void open(e.target.value)} disabled={busy}><option value="">Selecione uma ficha...</option>{list.map(c=><option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
 {current&&<article><label className="field">Nome<input value={name} onChange={e=>setName(e.target.value)} /></label>
 <button onClick={()=>void save()} disabled={busy||!name.trim()||name===current.name}>Salvar nome</button>
 <div className="stats"><CharacterSheetDerivedTile label="PV atual" value={String(number(hp.current)??"—")} /><CharacterSheetDerivedTile label="PV máximo" value={String(number(hp.max)??"—")}/><CharacterSheetDerivedTile label="CA" value={String(number(stats.ac)??"—")}/></div>
 <p>Esta é uma visualização inicial dos campos da ficha. Para ataques, magias, inventário, edição avançada e personagens ativos em uma sessão, use a ficha completa.</p>
 <a href={profile+"/characters/"+encodeURIComponent(current.id)} target="_blank" rel="noopener noreferrer">Abrir no D&D Manager ↗</a>
 </article>}
 </section><footer>Permissões e persistência pertencem ao D&D Manager. Não cole tokens nem senhas na extensão.</footer>
 </main>
}
createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>)
