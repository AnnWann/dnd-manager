import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Search, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Spell } from "../../../models/magic/spells/Spell"

const TARGET_CLASS = "progression-spell-selector-enhanced"

type SpellProxy = {
  spell: Spell
  button: HTMLButtonElement
  checkbox?: HTMLInputElement
  selected: boolean
  prepared: boolean
}

type Target = {
  element: HTMLDetailsElement
  key: string
  title: string
  maxCantrips: number
  maxLeveled: number
}

type LevelFilter = "all" | "cantrip" | `${number}`

export function ProgressionSpellSelectionModal() {
  const { spells } = useMagicContext()
  const [target, setTarget] = useState<Target | null>(null)
  const [query, setQuery] = useState("")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [schoolFilter, setSchoolFilter] = useState("all")
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [preparedIds, setPreparedIds] = useState<Set<string>>(new Set())
  const [refreshToken, setRefreshToken] = useState(0)
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    if (typeof document === "undefined") return

    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(enhanceSpellSelectors)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    const onClick = (event: MouseEvent) => {
      const clicked = event.target
      if (!(clicked instanceof Element)) return
      const summary = clicked.closest<HTMLElement>(
        `details.${TARGET_CLASS} > summary`,
      )
      if (!summary) return

      event.preventDefault()
      event.stopPropagation()
      const details = summary.parentElement
      if (!(details instanceof HTMLDetailsElement)) return
      const parsed = parseTarget(details)
      if (!parsed) return

      const proxies = parseSpellProxies(details, spells)
      setTarget(parsed)
      setQuery("")
      setLevelFilter("all")
      setSchoolFilter("all")
      setSelectedOnly(false)
      setSelectedIds(new Set(proxies.filter((entry) => entry.selected).map((entry) => entry.spell.index)))
      setPreparedIds(new Set(proxies.filter((entry) => entry.prepared).map((entry) => entry.spell.index)))
      setErrorMessage("")
    }

    document.addEventListener("click", onClick, true)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("click", onClick, true)
      document
        .querySelectorAll(`details.${TARGET_CLASS}`)
        .forEach((element) => element.classList.remove(TARGET_CLASS))
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
    void refreshToken
    if (!target) return null
    if (target.element.isConnected) return parseTarget(target.element) ?? target
    return findTarget(target.key) ?? target
  }, [refreshToken, target])

  const proxies = useMemo(() => {
    void refreshToken
    if (!liveTarget) return []
    return parseSpellProxies(liveTarget.element, spells)
  }, [liveTarget, refreshToken, spells])

  const schools = useMemo(
    () =>
      Array.from(new Set(proxies.map((entry) => String(entry.spell.school))))
        .map((value) => ({
          value,
          label: MAGIC_SCHOOLS_MAP[value] ?? value,
        }))
        .toSorted((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [proxies],
  )

  const visible = useMemo(() => {
    const normalizedQuery = normalize(query)
    return proxies.filter(({ spell }) => {
      const selected = selectedIds.has(spell.index)
      const searchable = normalize(
        `${spell.displayName ?? ""} ${spell.name} ${spell.description} ${spell.school}`,
      )
      return (
        (!normalizedQuery || searchable.includes(normalizedQuery)) &&
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

  const selectedSpells = proxies
    .map((entry) => entry.spell)
    .filter((spell) => selectedIds.has(spell.index))
  const cantripCount = selectedSpells.filter((spell) => spell.slotLevel === 0).length
  const leveledCount = selectedSpells.filter((spell) => spell.slotLevel > 0).length

  function close() {
    setTarget(null)
    setErrorMessage("")
  }

  function toggleSpell(proxy: SpellProxy) {
    const { spell } = proxy
    const selected = selectedIds.has(spell.index)

    if (!selected) {
      const current = spell.slotLevel === 0 ? cantripCount : leveledCount
      const limit =
        spell.slotLevel === 0
          ? liveTarget?.maxCantrips ?? 0
          : liveTarget?.maxLeveled ?? 0
      if (current >= limit) {
        setErrorMessage(
          spell.slotLevel === 0
            ? `O limite de ${limit} truques já foi atingido.`
            : `O limite de ${limit} magias já foi atingido. Remova ou substitua uma magia antes de continuar.`,
        )
        return
      }
    }

    setErrorMessage("")
    setSelectedIds((current) => {
      const next = new Set(current)
      if (selected) next.delete(spell.index)
      else next.add(spell.index)
      return next
    })
    if (selected) {
      setPreparedIds((current) => {
        const next = new Set(current)
        next.delete(spell.index)
        return next
      })
    }

    proxy.button.click()
    window.setTimeout(() => setRefreshToken((value) => value + 1), 0)
  }

  function togglePrepared(proxy: SpellProxy) {
    if (!proxy.checkbox || !selectedIds.has(proxy.spell.index)) return
    const prepared = preparedIds.has(proxy.spell.index)
    setPreparedIds((current) => {
      const next = new Set(current)
      if (prepared) next.delete(proxy.spell.index)
      else next.add(proxy.spell.index)
      return next
    })
    proxy.checkbox.click()
    window.setTimeout(() => setRefreshToken((value) => value + 1), 0)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={liveTarget.title}
      onMouseDown={close}
    >
      <section
        className="grid max-h-[94dvh] w-full max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-textH">{liveTarget.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-textMuted">
              <Badge label={`Truques ${cantripCount}/${liveTarget.maxCantrips}`} />
              <Badge label={`Magias ${leveledCount}/${liveTarget.maxLeveled}`} />
              <span>As escolhas são aplicadas imediatamente ao personagem em criação.</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-[minmax(0,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              className="pl-9"
              value={query}
              placeholder="Buscar por nome, descrição ou escola"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
          >
            <option value="all">Todos os níveis</option>
            <option value="cantrip">Truques</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>{level}º nível</option>
            ))}
          </select>
          <select
            className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
            value={schoolFilter}
            onChange={(event) => setSchoolFilter(event.target.value)}
          >
            <option value="all">Todas as escolas</option>
            {schools.map((school) => (
              <option key={school.value} value={school.value}>{school.label}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-text">
            <input
              type="checkbox"
              checked={selectedOnly}
              onChange={(event) => setSelectedOnly(event.target.checked)}
            />
            Selecionadas
          </label>
        </div>

        <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
          {errorMessage ? (
            <div className="mb-4 rounded-xl border border-danger bg-dangerBg p-3 text-sm text-danger">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((proxy) => {
              const { spell } = proxy
              const selected = selectedIds.has(spell.index)
              const prepared = preparedIds.has(spell.index)
              return (
                <article
                  key={spell.index}
                  className={
                    selected
                      ? "rounded-xl border border-accentBorder bg-accentBg p-4"
                      : "rounded-xl border border-border bg-bg p-4"
                  }
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-pressed={selected}
                    onClick={() => toggleSpell(proxy)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-textH">{spellLabel(spell)}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge label={spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º nível`} />
                          <Badge label={MAGIC_SCHOOLS_MAP[spell.school] ?? String(spell.school)} />
                          {spell.concentration ? <Badge label="Concentração" /> : null}
                          {spell.ritual ? <Badge label="Ritual" /> : null}
                        </div>
                      </div>
                      {selected ? <Check className="h-4 w-4 shrink-0 text-textH" /> : null}
                    </div>
                    <p className="mt-3 line-clamp-3 text-xs leading-5 text-textMuted">
                      {spell.description || "Sem descrição cadastrada."}
                    </p>
                  </button>

                  <details className="mt-3 text-xs text-text">
                    <summary className="cursor-pointer font-medium text-textH">
                      Ler detalhes completos
                    </summary>
                    <div className="mt-2 grid gap-2 leading-5 text-textMuted">
                      <p className="whitespace-pre-wrap">{spell.description || "Sem descrição cadastrada."}</p>
                      {spell.higherLevelText?.trim() ? (
                        <p className="whitespace-pre-wrap">
                          <strong className="text-textH">Em níveis superiores: </strong>
                          {spell.higherLevelText}
                        </p>
                      ) : null}
                    </div>
                  </details>

                  {proxy.checkbox && selected && spell.slotLevel > 0 ? (
                    <label className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-xs text-text">
                      <input
                        type="checkbox"
                        checked={prepared}
                        onChange={() => togglePrepared(proxy)}
                      />
                      Preparar esta magia
                    </label>
                  ) : null}
                </article>
              )
            })}
          </div>

          {!visible.length ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-textMuted">
              Nenhuma magia corresponde aos filtros atuais.
            </div>
          ) : null}
        </main>

        <footer className="flex justify-end border-t border-border p-4 sm:p-5">
          <Button onClick={close}>Concluir seleção</Button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function enhanceSpellSelectors() {
  document.querySelectorAll<HTMLDetailsElement>("details").forEach((details) => {
    const summary = details.querySelector(":scope > summary")
    const text = summary?.textContent?.trim() ?? ""
    if (!normalize(text).startsWith("selecionar e ler magias de")) return
    details.classList.add(TARGET_CLASS)
    details.open = false
  })
}

function parseTarget(element: HTMLDetailsElement): Target | undefined {
  const raw = element.querySelector(":scope > summary")?.textContent?.trim() ?? ""
  const limits = raw.match(/truques\s+\d+\/(\d+)\s*·\s*magias\s+\d+\/(\d+)/i)
  if (!raw || !limits) return undefined
  const title = raw.split("·")[0]?.trim() || "Selecionar magias"
  return {
    element,
    key: normalize(title),
    title,
    maxCantrips: Number(limits[1]) || 0,
    maxLeveled: Number(limits[2]) || 0,
  }
}

function findTarget(key: string): Target | undefined {
  for (const element of Array.from(
    document.querySelectorAll<HTMLDetailsElement>(`details.${TARGET_CLASS}`),
  )) {
    const parsed = parseTarget(element)
    if (parsed?.key === key) return parsed
  }
  return undefined
}

function parseSpellProxies(
  element: HTMLDetailsElement,
  spells: Spell[],
): SpellProxy[] {
  const byName = new Map<string, Spell>()
  for (const spell of spells) {
    byName.set(normalize(spell.name), spell)
    if (spell.displayName?.trim()) byName.set(normalize(spell.displayName), spell)
  }

  return Array.from(element.querySelectorAll<HTMLElement>("article"))
    .map((article) => {
      const button = article.querySelector<HTMLButtonElement>(":scope > button")
      const label = article.querySelector("strong")?.textContent?.trim() ?? ""
      const spell = byName.get(normalize(label))
      if (!button || !spell) return undefined
      const checkbox = article.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? undefined
      return {
        spell,
        button,
        checkbox,
        selected:
          article.classList.contains("border-accentBorder") ||
          article.classList.contains("bg-accentBg"),
        prepared: checkbox?.checked === true,
      }
    })
    .filter((entry): entry is SpellProxy => Boolean(entry))
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
  return (
    <span className="inline-flex rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {label}
    </span>
  )
}
