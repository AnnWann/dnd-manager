import React, { useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import OBR from "@owlbear-rodeo/sdk"
import "./style.css"

const appOrigin = (import.meta.env.VITE_DND_MANAGER_URL || "https://dnd-magic-manager.vercel.app").replace(/\/$/, "")
const sheetPath = "/user"
const sheetUrl = appOrigin + sheetPath

function App() {
  const [embedded, setEmbedded] = useState(false)
  const [owlbearConnected, setOwlbearConnected] = useState(false)
  useEffect(() => {
    let active = true
    OBR.onReady(() => { if (active) setOwlbearConnected(true) })
    return () => { active = false }
  }, [])

  return <main>
    <header><span className="brand">D&D Manager</span><span className="sub">Fichas de personagens</span></header>
    <section className="intro">
      <h1>Sua ficha, sem duplicar dados</h1>
      <p>Use os personagens e permissões da sua conta do D&D Manager. Alterações são salvas pelo próprio aplicativo, não pela extensão.</p>
      {!owlbearConnected && <p className="notice">Abra este endereço como uma extensão dentro de uma sala do Owlbear Rodeo.</p>}
    </section>
    <nav aria-label="Acesso às fichas">
      <button type="button" onClick={() => setEmbedded(true)} disabled={embedded}>Abrir fichas neste painel</button>
      <a href={sheetUrl} target="_blank" rel="noopener noreferrer">Abrir fichas em uma nova aba ↗</a>
    </nav>
    {embedded && <div className="embedded">
      <div className="embedded-title"><span>Área de personagens</span><button type="button" onClick={() => setEmbedded(false)}>Fechar</button></div>
      <iframe title="Fichas do D&D Manager" src={sheetUrl} referrerPolicy="strict-origin-when-cross-origin" />
    </div>}
    <footer>O acesso depende de login no D&D Manager. Se o navegador bloquear cookies de terceiros ou o site não permitir incorporação, use a opção de nova aba. Nenhuma credencial é enviada ao Owlbear.</footer>
  </main>
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>)
