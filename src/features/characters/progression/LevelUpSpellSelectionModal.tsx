import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Search, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Spell } from "../../../models/magic/spells/Spell"

const SECTION_CLASS = "level-up-spell-selector-enhanced"
const OPEN_BUTTON_CLASS = "level-up-spell-modal-open"

type Proxy = {
  spell: Spell
  button: HTMLButtonElement
  checkbox?: HTMLInputElement
  selected: boolean
  prepared: boolean
}

type Target = {
  section: HTMLElement
  title: string
  key: string
  maxCantrips: number
  maxLeveled: number
  maxPrepared: number
}

type LevelFilter = "all" | "cantrip" | `${number}`

export function LevelUpSpellSelectionModal() {
  const { spells } = useMagicContext()
  const [target, setTarget] = useState<Target | null>(null)
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [preparedIds, setPreparedIds] = useState<Set<string>>(new Set())
  const [refresh, setRefresh] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(enhanceSections)
    }
    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    const onClick = (event: MouseEvent) => {
      const element = event.target
      if (!(element instanceof Element)) return
      const opener = element.closest<HTMLButtonElement>(`.${OPEN_BUTTON_CLASS}`)
      if (!opener) return
      const section = opener.closest<HTMLElement>(`section.${SECTION_CLASS}`)
      if (!section) return
      event.preventDefault()
      event.stopPropagation()
      clearUnderlyingSearch(section)
      window.setTimeout(() => open(section), 0)
    }

    const open = (section: HTMLElement) => {
      const parsed = parseTarget(section)
      if (!parsed) return
      const proxies = parseProxies(section, spells)
      setTarget(parsed)
      setQuery("")
      setLevelFilter("all")
      setSchoolFilter("all")
      setSelectedOnly(false)
      setSelectedIds(new Set(proxies.filter((entry) => entry.selected).map((entry) => entry.spell.index)))
      setPreparedIds(new Set(proxies.filter((entry) => entry.prepared).map((entry) => entry.spell.index)))
      setError("")
    }

    document.addEventListener("click", onClick, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("click", onClick, true)
      document.querySelectorAll<HTMLElement>(`.${SECTION_CLASS}`).forEach((section) => {
        section.classList.remove(SECTION_CLASS)
        section.querySelector(`.${OPEN_BUTTON_CLASS}`)?.remove()
        section.querySelectorAll<HTMLElement>("[data-level-up-spell-inline]").forEach((entry) => {
          entry.style.display = ""
          delete entry.dataset.levelUpSpellInline
        })
      })
    }
  }, [spells])

  useEffect(() => {
    if (!target) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTarget(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [target])

  const liveTarget = useMemo(() => {
    void refresh
    if (!target) return null
    if (target.section.isConnected) return parseTarget(target.section) ?? target
    return findTarget(target.key) ?? target
  }, [refresh, target])

  const proxies = useMemo(() => {
    void refresh
    return liveTarget ? parseProxies(liveTarget.section, spells) : []
  }, [liveTarget, refresh, spells])

  const schools = useMemo(
    () =>
      Array.from(new Set(proxies.map((entry) => String(entry.spell.school))))
        .map((value) => ({ value, label: MAGIC_SCHOOLS_MAP[value] ?? value }))
        .toSorted((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [proxies],
  )

  const visible = useMemo(() => {
    const normalized = normalize(query)
    return proxies.filter(({ spell }) => {
      const selected = selectedIds.has(spell.index)
      const text = normalize(`${spell.displayName ?? ""} ${spell.name} ${spell.description} ${spell.school}`)
      return (
        (!normalized || text.includes(normalized)) &&
        (levelFilter === "all" ||
          (levelFilter === "cantrip"
            ? spell.slotLevel === 0
            : spell.slotLevel === Number(levelFilter))) &&
        (schoolFilter === "all" || String(spell.school) === schoolFilter) &&
        (!selectedOnly || selected)
      )
    })
  }, [levelFilter, proxies, query, schoolFilter, selectedIds, selectedOnly])

  if (!liveTarget || typeof document === "undefined") return null
  const activeTarget = liveTarget

  const selectedSpells = proxies.map((entry) => entry.spell).filter((spell) => selectedIds.has(spell.index))
  const cantripCount = selectedSpells.filter((spell) => spell.slotLevel === 0).length
  const leveledCount = selectedSpells.filter((spell) => spell.slotLevel > 0).length

  function toggle(proxy: Proxy) {
    const selected = selectedIds.has(proxy.spell.index)
    if (!selected) {
      const current = proxy.spell.slotLevel === 0 ? cantripCount : leveledCount
      const limit = proxy.spell.slotLevel === 0 ? activeTarget.maxCantrips : activeTarget.maxLeveled
      if (current >= limit) {
        setError(
          proxy.spell.slotLevel === 0
            ? `O limite de ${limit} truques já foi atingido.`
            : `O limite de ${limit} magias já foi atingido. Remova ou substitua uma magia.`,
        )
        return
      }
    }

    setError("")
    setSelectedIds((current) => {
      const next = new Set(current)
      if (selected) next.delete(proxy.spell.index)
      else next.add(proxy.spell.index)
      return next
    })
    if (selected) {
      setPreparedIds((current) => {
        const next = new Set(current)
        next.delete(proxy.spell.index)
        return next
      })
    }
    proxy.button.click()
    window.setTimeout(() => setRefresh((value) => value + 1), 0)
  }

  function togglePrepared(proxy: Proxy) {
    if (!proxy.checkbox || !selectedIds.has(proxy.spell.index)) return
    const prepared = preparedIds.has(proxy.spell.index)
    if (!prepared && activeTarget.maxPrepared > 0 && preparedIds.size >= activeTarget.maxPrepared) {
      setError(`O limite de ${activeTarget.maxPrepared} magias preparadas já foi atingido.`)
      return
    }
    setError("")
    setPreparedIds((current) => {
      const next = new Set(current)
      if (prepared) next.delete(proxy.spell.index)
      else next.add(proxy.spell.index)
      return next
    })
    proxy.checkbox.click()
    window.setTimeout(() => setRefresh((value) => value + 1), 0)
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" onMouseDown={() => setTarget(null)}>
      <section className="grid max-h-[94dvh] w-full max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-textH">{activeTarget.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge label={`Truques ${cantripCount}/${activeTarget.maxCantrips}`} />
              <Badge label={`Magias ${leveledCount}/${activeTarget.maxLeveled}`} />
              {activeTarget.maxPrepared ? <Badge label={`Preparadas ${preparedIds.size}/${activeTarget.maxPrepared}`} /> : null}
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={() => setTarget(null)} className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input className="pl-9" value={query} placeholder="Buscar por nome, descrição ou escola" onChange={(event) => setQuery(event.target.value)} />
          </div>
          <select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH" value={levelFilter} onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}>
            <option value="all">Todos os níveis</option>
            <option value="cantrip">Truques</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>{level}º nível</option>
            ))}
          </select>
          <select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH" value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
            <option value="all">Todas as escolas</option>
            {schools.map((school) => <option key={school.value} value={school.value}>{school.label}</option>)}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-text">
            <input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)} />
            Selecionadas
          </label>
        </div>

        <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
          {error ? <div className="mb-4 rounded-xl border border-danger bg-dangerBg p-3 text-sm text-danger">{error}</div> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((proxy) => {
              const selected = selectedIds.has(proxy.spell.index)
              const prepared = preparedIds.has(proxy.spell.index)
              return (
                <article key={proxy.spell.index} className={selected ? "rounded-xl border border-accentBorder bg-accentBg p-4" : "rounded-xl border border-border bg-bg p-4"}>
                  <button type="button" className="w-full text-left" onClick={() => toggle(proxy)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-textH">{spellLabel(proxy.spell)}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge label={proxy.spell.slotLevel === 0 ? "Truque" : `${proxy.spell.slotLevel}º nível`} />
                          <Badge label={MAGIC_SCHOOLS_MAP[proxy.spell.school] ?? String(proxy.spell.school)} />
                          {proxy.spell.concentration ? <Badge label="Concentração" /> : null}
                          {proxy.spell.ritual ? <Badge label="Ritual" /> : null}
                        </div>
                      </div>
                      {selected ? <Check className="h-4 w-4 shrink-0" /> : null}
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-textMuted">{proxy.spell.description || "Sem descrição cadastrada."}</p>
                  </button>
                  <details className="mt-3 text-xs text-text">
                    <summary className="cursor-pointer font-medium text-textH">Ler detalhes completos</summary>
                    <p className="mt-2 whitespace-pre-wrap leading-5 text-textMuted">{proxy.spell.description || "Sem descrição cadastrada."}</p>
                  </details>
                  {proxy.checkbox && selected && proxy.spell.slotLevel > 0 ? (
                    <label className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-text">
                      <input type="checkbox" checked={prepared} onChange={() => togglePrepared(proxy)} />
                      Preparar esta magia
                    </label>
                  ) : null}
                </article>
              )
            })}
          </div>
        </main>

        <footer className="flex justify-end border-t border-border p-4 sm:p-5">
          <Button onClick={() => setTarget(null)}>Concluir seleção</Button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function enhanceSections() {
  document.querySelectorAll<HTMLElement>("section").forEach((section) => {
    const paragraph = Array.from(section.querySelectorAll("p")).find((entry) =>
      normalize(entry.textContent ?? "").includes("nivel maximo de magia"),
    )
    const heading = section.querySelector<HTMLElement>("h2")
    if (!paragraph || !heading) return
    section.classList.add(SECTION_CLASS)

    if (!section.querySelector(`.${OPEN_BUTTON_CLASS}`)) {
      const button = document.createElement("button")
      button.type = "button"
      button.className = `${OPEN_BUTTON_CLASS} mt-4 rounded-xl border border-accentBorder bg-accentBg px-4 py-3 text-sm font-semibold text-textH`
      button.textContent = "Abrir seleção completa de magias"
      paragraph.parentElement?.append(button)
    }

    const input = section.querySelector<HTMLInputElement>('input[placeholder="Buscar magia"]')
    if (input) {
      const container = input.parentElement
      if (container instanceof HTMLElement) {
        container.dataset.levelUpSpellInline = "true"
        container.style.display = "none"
      }
    }
    const grid = Array.from(section.querySelectorAll<HTMLElement>("div")).find((entry) =>
      entry.className.includes("overflow-y-auto") && entry.querySelector("article"),
    )
    if (grid) {
      grid.dataset.levelUpSpellInline = "true"
      grid.style.display = "none"
    }
  })
}

function parseTarget(section: HTMLElement): Target | undefined {
  const title = section.querySelector("h2")?.textContent?.trim() ?? "Selecionar magias"
  const texts = Array.from(section.querySelectorAll("span")).map((entry) => entry.textContent?.trim() ?? "")
  const cantrips = texts.find((entry) => /^Truques\s+\d+\/\d+/i.test(entry))?.match(/\/(\d+)/)
  const leveled = texts.find((entry) => /^Magias\s+\d+\/\d+/i.test(entry))?.match(/\/(\d+)/)
  const prepared = texts.find((entry) => /^Preparadas\s+\d+\/\d+/i.test(entry))?.match(/\/(\d+)/)
  if (!cantrips || !leveled) return undefined
  return {
    section,
    title: `Selecionar magias de ${title}`,
    key: normalize(title),
    maxCantrips: Number(cantrips[1]) || 0,
    maxLeveled: Number(leveled[1]) || 0,
    maxPrepared: Number(prepared?.[1]) || 0,
  }
}

function findTarget(key: string): Target | undefined {
  for (const section of Array.from(document.querySelectorAll<HTMLElement>(`section.${SECTION_CLASS}`))) {
    const parsed = parseTarget(section)
    if (parsed?.key === key) return parsed
  }
  return undefined
}

function parseProxies(section: HTMLElement, spells: Spell[]): Proxy[] {
  const byName = new Map<string, Spell>()
  for (const spell of spells) {
    byName.set(normalize(spell.name), spell)
    if (spell.displayName?.trim()) byName.set(normalize(spell.displayName), spell)
  }
  return Array.from(section.querySelectorAll<HTMLElement>("article")).flatMap<Proxy>((article) => {
    const button = article.querySelector<HTMLButtonElement>(":scope > button")
    const label = article.querySelector("span.font-medium, strong, .font-medium")?.textContent?.trim() ?? ""
    const spell = byName.get(normalize(label))
    if (!button || !spell) return []
    const checkbox = article.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? undefined
    return [{
      spell,
      button,
      checkbox,
      selected: article.classList.contains("border-accentBorder") || article.classList.contains("bg-accentBg"),
      prepared: checkbox?.checked === true,
    }]
  })
}

function clearUnderlyingSearch(section: HTMLElement) {
  const input = section.querySelector<HTMLInputElement>('input[placeholder="Buscar magia"]')
  if (!input || !input.value) return
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set
  setter?.call(input, "")
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

function spellLabel(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function Badge({ label }: { label: string }) {
  return <span className="inline-flex rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">{label}</span>
}