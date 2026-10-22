import { DEFAULT_CAMPAIGN_TIME, faerunDate, moonPhase, campaignWeather, campaignLight } from "../../../../../packages/session-protocol/src/campaignTime"
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import { useOptionalSessionRuntime } from "../../features/session-runtime/useSessionRuntime"
import { Select } from "../../components/ui/Select"
import type {
  SessionPanel,
  SessionPanelVisibility,
} from "../../../../../packages/session-protocol/src/sessionPanels"

const visibilityOptions: { value: SessionPanelVisibility; label: string }[] = [
  { value: "private", label: "Somente mestre" },
  { value: "shared", label: "Todos visualizam; mestre controla" },
  { value: "collaborative", label: "Todos visualizam; controle compartilhado" },
]
const field = "w-full rounded-xl border border-border bg-bg-subtle px-3 py-2 text-sm text-textH"
const button = "rounded-xl border border-border bg-bg-subtle px-3 py-2 text-sm text-textH hover:border-accentBorder disabled:opacity-40"

function newPanel(kind: SessionPanel["kind"]): SessionPanel {
  return {
    id: crypto.randomUUID().replace(/-/g, ""),
    title: kind === "clock" ? "Novo relógio" : "Nova ferramenta HTML",
    kind,
    visibility: "private",
    ...(kind === "clock" ? { clock: { value: 0, max: 6, label: "Segmentos" } } : { html: "", playerHtml: "" }),
  }
}

function escapeScriptJson(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
}

/**
 * HTML is untrusted. It executes in an opaque-origin iframe without credentials,
 * popups, navigation or external network access. The localStorage compatibility
 * shim lets standalone HTML tools persist their state via the master session.
 */
function sandboxDocument(html: string, storage: Record<string, string>, panelId: string) {
  const bootstrap = `
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; font-src data:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
<script>
const localStorage = (() => {
 const cache = ${escapeScriptJson(storage)};
 return {
  getItem(key) { return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : null; },
  setItem(key, value) {
   cache[String(key)] = String(value);
   window.parent.postMessage({ type: "dnd-manager.panel.storage", id: ${escapeScriptJson(panelId)}, storage: cache }, "*");
  },
  removeItem(key) { delete cache[key]; window.parent.postMessage({type:"dnd-manager.panel.storage",id:${escapeScriptJson(panelId)},storage:cache},"*"); },
  clear() { for (const key of Object.keys(cache)) delete cache[key]; window.parent.postMessage({type:"dnd-manager.panel.storage",id:${escapeScriptJson(panelId)},storage:cache},"*"); },
  key(index) { return Object.keys(cache)[index] ?? null; },
  get length() { return Object.keys(cache).length; }
 };
})();
</script>`
  const head = /<head(?:\s[^>]*)?>/i
  return head.test(html) ? html.replace(head, match => match + bootstrap)
    : `<!doctype html><html><head>${bootstrap}</head><body>${html}</body></html>`
}

function HtmlPanel({
  panel, canEdit, onStorage,
}: {
  panel: SessionPanel
  canEdit: boolean
  onStorage: (id: string, storage: Record<string, string>) => void
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Storage snapshots after an iframe write must not remount the tool.
  const srcDoc = useMemo(
    () => sandboxDocument(panel.html ?? "", panel.storage ?? {}, panel.id),
    // The document is deliberately not regenerated on storage revisions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel.id, panel.html],
  )
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!canEdit || event.source !== iframeRef.current?.contentWindow) return
      const data = event.data
      if (!data || data.type !== "dnd-manager.panel.storage" || data.id !== panel.id) return
      const storage = data.storage
      if (!storage || typeof storage !== "object" || Array.isArray(storage)) return
      if (JSON.stringify(storage).length > 85000) return
      if (!Object.entries(storage).every(([key, value]) => key.length <= 200 && typeof value === "string")) return
      onStorage(panel.id, storage as Record<string, string>)
    }
    window.addEventListener("message", receive)
    return () => window.removeEventListener("message", receive)
  }, [canEdit, onStorage, panel.id])
  if (!panel.html?.trim()) {
    return <p className="rounded-xl border border-dashed border-border p-6 text-sm text-textMuted">
      {canEdit ? "Adicione o HTML no editor para visualizar a ferramenta." : "O mestre ainda não publicou uma visualização para os jogadores."}
    </p>
  }
  return (
    <iframe
      ref={iframeRef}
      title={panel.title}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="h-[min(74vh,900px)] min-h-[420px] w-full rounded-xl border border-border bg-white"
    />
  )
}

function ClockPanel({
  panel, canControl, advance,
}: {
  panel: SessionPanel
  canControl: boolean
  advance: (delta: number) => void
}) {
  const clock = panel.clock
  if (!clock) return null
  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-textH">{panel.title}</p>
          <p className="text-sm text-textMuted">{clock.label}</p>
        </div>
        <span className="text-xl font-bold text-accent">{clock.value} / {clock.max}</span>
      </div>
      <div className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {Array.from({ length: clock.max }, (_, i) => (
          <div key={i} className={`h-10 rounded-lg border border-accentBorder ${i < clock.value ? "bg-accent" : "bg-bg"}`} />
        ))}
      </div>
      {canControl && (
        <div className="flex gap-2">
          <button className={button} disabled={clock.value <= 0} onClick={() => advance(-1)}>− Retroceder</button>
          <button className={button} disabled={clock.value >= clock.max} onClick={() => advance(1)}>+ Avançar</button>
        </div>
      )}
    </div>
  )
}

export function SessionPanelsView() {
  const runtime = useOptionalSessionRuntime()
  const panels = runtime?.panelsState?.panels ?? []
  const isMaster = runtime?.role === "MASTER"
  const dispatch = runtime?.dispatchPanelOperation
  const [selectedId, setSelectedId] = useState("")
  const [editor, setEditor] = useState<SessionPanel | null>(null)
  const [error, setError] = useState("")
  const [newKind, setNewKind] = useState<SessionPanel["kind"]>("clock")
  const [busy, setBusy] = useState(false)
  const selected = panels.find(panel => panel.id === selectedId) ?? panels[0]
  const activeId = selected?.id ?? ""

  function send(operation: Parameters<NonNullable<typeof dispatch>>[0]) {
    if (!dispatch?.(operation)) {
      setError("A sessão está desconectada. Nenhuma alteração foi enviada.")
      return false
    }
    setError("")
    return true
  }

  function save() {
    if (!editor || !editor.title.trim()) {
      setError("Informe um título para o painel.")
      return
    }
    if (editor.kind === "clock" && (!editor.clock || !Number.isInteger(editor.clock.max) || editor.clock.max < 1 || editor.clock.max > 36)) {
      setError("O relógio precisa ter entre 1 e 36 segmentos.")
      return
    }
    if (editor.kind === "html" && ((editor.html?.length ?? 0) > 75000 || (editor.playerHtml?.length ?? 0) > 75000)) {
      setError("Cada documento HTML deve ter até 75 mil caracteres.")
      return
    }
    if (send({ type: "upsert", panel: { ...editor, title: editor.title.trim() } })) {
      setSelectedId(editor.id)
      setEditor(null)
    }
  }

  function remove(panel: SessionPanel) {
    if (!window.confirm(`Excluir o painel "${panel.title}" da sessão?`)) return
    if (send({ type: "delete", id: panel.id })) setEditor(null)
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, fieldName: "html" | "playerHtml") {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    if (file.size > 75000) { setError("O arquivo deve ter até 75 KB."); return }
    setBusy(true)
    try {
      const contents = await file.text()
      setEditor(current => current ? { ...current, [fieldName]: contents } : current)
    } finally { setBusy(false) }
  }

  const onStorage = (id: string, storage: Record<string, string>) => {
    // Only the authoritative master view can persist iframe storage.
    if (isMaster) send({ type: "storage.replace", id, storage })
  }

  if (!runtime) return <p>Os Painéis da Sessão estão disponíveis dentro de uma campanha ativa.</p>
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-textH">Painéis da Sessão</h1>
          <p className="mt-1 text-sm text-textMuted">
            Relógios compartilhados e ferramentas HTML isoladas, com visibilidade definida pelo mestre.
          </p>
        </div>
        {isMaster && !editor && (
          <div className="flex gap-2">
            <Select className={field} value={newKind} onChange={e => setNewKind(e.target.value as SessionPanel["kind"])}>
              <option value="clock">Relógio</option>
              <option value="html">Painel HTML</option>
            </Select>
            <button className={button} onClick={() => setEditor(newPanel(newKind))}>+ Adicionar</button>
          </div>
        )}
      </div>

      {runtime.status !== "connected" && (
        <p className="rounded-xl border border-border p-3 text-sm text-textMuted">Conecte-se à sessão para ver ou alterar os painéis.</p>
      )}
      {error && <p role="alert" className="rounded-xl border border-danger p-3 text-sm text-danger">{error}</p>}

      {editor && isMaster ? (
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-bg p-4">
          <h2 className="font-semibold text-textH">{panels.some(p => p.id === editor.id) ? "Editar painel" : "Adicionar painel"}</h2>
          <label className="grid gap-1 text-sm">Nome
            <input className={field} value={editor.title} maxLength={100} onChange={e => setEditor({ ...editor, title: e.target.value })} />
          </label>
          <label className="grid gap-1 text-sm">Visibilidade
            <Select className={field} value={editor.visibility} onChange={e => setEditor({ ...editor, visibility: e.target.value as SessionPanelVisibility })}>
              {visibilityOptions.filter(option => editor.kind === "clock" || option.value !== "collaborative").map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
            </Select>
          </label>
          {editor.kind === "clock" && editor.clock && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-sm">Segmentos
                <input className={field} type="number" min={1} max={36} value={editor.clock.max}
                  onChange={e => {
                    const max = Number(e.target.value)
                    setEditor({ ...editor, clock: { ...editor.clock!, max, value: Math.min(editor.clock!.value, max) } })
                  }} />
              </label>
              <label className="grid gap-1 text-sm">Progresso
                <input className={field} type="number" min={0} max={editor.clock.max} value={editor.clock.value}
                  onChange={e => setEditor({ ...editor, clock: { ...editor.clock!, value: Number(e.target.value) } })} />
              </label>
              <label className="grid gap-1 text-sm">Legenda
                <input className={field} maxLength={100} value={editor.clock.label}
                  onChange={e => setEditor({ ...editor, clock: { ...editor.clock!, label: e.target.value } })} />
              </label>
            </div>
          )}
          {editor.kind === "html" && (
            <>
              <div className="rounded-lg border border-border p-3 text-xs leading-5 text-textMuted">
                O documento executa em um iframe isolado, sem acesso aos cookies da sessão, navegação ou chamadas externas. 
                O armazenamento local é preservado pelo servidor. <strong>O HTML do mestre nunca é enviado aos jogadores.</strong>
                Para compartilhar um mapa, forneça separadamente uma versão pública sem segredos.
              </div>
              <label className="grid gap-1 text-sm">HTML do mestre
                <input type="file" accept=".html,.htm,text/html" disabled={busy} onChange={e => void upload(e, "html")} />
                <textarea className={field} rows={10} value={editor.html ?? ""} onChange={e => setEditor({ ...editor, html: e.target.value })} placeholder="Cole ou importe o arquivo HTML..." />
              </label>
              {editor.visibility !== "private" && (
                <label className="grid gap-1 text-sm">HTML dos jogadores (sem segredos)
                  <input type="file" accept=".html,.htm,text/html" disabled={busy} onChange={e => void upload(e, "playerHtml")} />
                  <textarea className={field} rows={6} value={editor.playerHtml ?? ""} onChange={e => setEditor({ ...editor, playerHtml: e.target.value })} placeholder="Versão pública opcional. Nenhum conteúdo privado será compartilhado automaticamente." />
                </label>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <button className={button} onClick={save}>Salvar painel</button>
            <button className={button} onClick={() => { setEditor(null); setError("") }}>Cancelar</button>
          </div>
        </section>
      ) : null}

      <CampaignCalendar time={runtime.panelsState?.campaignTime ?? DEFAULT_CAMPAIGN_TIME} isMaster={isMaster} advance={minutes => send({type:"time.advance",minutes})} />
      {panels.length > 0 ? (
        <>
          <nav className="flex flex-wrap gap-2" aria-label="Selecionar painel">
            {panels.map(panel => (
              <button key={panel.id} className={`${button} ${activeId === panel.id ? "border-accentBorder bg-accentBg font-semibold" : ""}`}
                onClick={() => setSelectedId(panel.id)}>{panel.kind === "clock" ? "◷ " : "▣ "}{panel.title}</button>
            ))}
          </nav>
          {selected && (
            <section className="min-w-0 rounded-xl border border-border bg-bg p-3 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-textH">{selected.title}</h2>
                  <p className="text-xs text-textMuted">{visibilityOptions.find(option => option.value === selected.visibility)?.label}</p>
                </div>
                {isMaster && !editor && (
                  <div className="flex gap-2">
                    <button className={button} onClick={() => setEditor({ ...selected })}>Editar</button>
                    <button className={button} onClick={() => remove(selected)}>Excluir</button>
                  </div>
                )}
              </div>
              {selected.kind === "clock" ? (
                <ClockPanel panel={selected} canControl={runtime.status === "connected" && (isMaster || selected.visibility === "collaborative")}
                  advance={delta => send({ type: "clock.advance", id: selected.id, delta })} />
              ) : (
                <HtmlPanel key={selected.id} panel={selected} canEdit={isMaster} onStorage={onStorage} />
              )}
            </section>
          )}
        </>
      ) : !editor ? (
        <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-textMuted">
          {isMaster ? "Nenhum painel criado. Adicione um relógio ou uma ferramenta HTML." : "O mestre ainda não compartilhou painéis com você."}
        </p>
      ) : null}
    </main>
  )
}

function CampaignCalendar({time,isMaster,advance}:{
 time: typeof DEFAULT_CAMPAIGN_TIME
 isMaster: boolean
 advance: (minutes:number)=>void
}) {
 const date = faerunDate(time.day,time.epochYear)
 const moon = moonPhase(time.day)
 const weather = campaignWeather(time)
 const light = campaignLight(time,weather)
 const labels: Record<string,string> = { daylight:"Luz do dia",penumbra:"Penumbra",moonlight:"Escuridão com lua",darkness:"Escuridão total" }
 const weatherLabels: Record<string,string> = {clear:"Ensolarado",cloudy:"Nublado",rain:"Chuva",storm:"Tempestade",fog:"Neblina",wind:"Ventos fortes"}
 const hh = String(Math.floor(time.minute/60)).padStart(2,"0")
 const mm = String(time.minute%60).padStart(2,"0")
 return <section className={`rounded-xl border border-border p-5 ${light==="darkness"||light==="moonlight"?"bg-slate-900 text-white":"bg-bg"}`}>
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-lg font-semibold">Relógio e calendário de Faerûn</h2>
    <p>{date.festival ?? `${date.dayOfMonth} de ${date.month}`} · ${date.year} CV · {date.tenday}º tenday</p>
    <p className="text-2xl font-bold">{hh}:{mm}</p>
   </div>
   <div className="text-sm">
    <p>Iluminação: <strong>{labels[light]}</strong></p>
    <p>Clima: <strong>{weatherLabels[weather]}</strong></p>
    <p>Selûne: fase {moon.index+1}/8 · {Math.round(moon.illumination*100)}% iluminada</p>
   </div>
  </div>
  {isMaster && <div className="mt-4 flex flex-wrap gap-2">
   <button className={button} onClick={()=>advance(60)}>+1 hora</button>
   <button className={button} onClick={()=>advance(360)}>+6 horas</button>
   <button className={button} onClick={()=>advance(1440)}>+1 dia</button>
   <button className={button} onClick={()=>advance(-60)}>−1 hora</button>
  </div>}
 </section>
}
