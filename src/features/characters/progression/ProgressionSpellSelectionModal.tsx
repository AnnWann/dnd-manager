import { Select as SharedSelect } from "../../../components/ui/Select"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { Check, Search, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import type { Spell } from "../../../models/magic/spells/Spell"

const FULL_LIST_CLASSES = ["artifice", "clerigo", "druida", "paladino"]

type SpellProxy = {
  spell: Spell
  button: HTMLButtonElement
  checkbox?: HTMLInputElement
  selected: boolean
  prepared: boolean
}

type Target = {
  element: HTMLDetailsElement
  title: string
  maxCantrips: number
  maxLeveled: number
  fullPreparedList: boolean
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
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const clicked = event.target
      if (!(clicked instanceof Element)) return
      const summary = clicked.closest<HTMLElement>("details > summary")
      if (!summary) return
      const details = summary.parentElement
      if (!(details instanceof HTMLDetailsElement)) return
      const parsed = parseTarget(details)
      if (!parsed) return

      event.preventDefault()
      event.stopPropagation()
      const proxies = parseSpellProxies(details, spells, parsed.fullPreparedList)
      setTarget(parsed)
      setQuery("")
      setLevelFilter(parsed.fullPreparedList ? "cantrip" : "all")
      setSchoolFilter("all")
      setSelectedOnly(false)
      setSelectedIds(
        new Set(
          proxies
            .filter((entry) => entry.selected)
            .map((entry) => entry.spell.index),
        ),
      )
      setPreparedIds(
        new Set(
          proxies
            .filter((entry) => entry.prepared)
            .map((entry) => entry.spell.index),
        ),
      )
      setErrorMessage("")
    }

    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [spells])

  useEffect(() => {
    if (!target) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTarget(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [target])

  const proxies = useMemo(
    () =>
      target
        ? parseSpellProxies(target.element, spells, target.fullPreparedList)
        : [],
    [spells, target],
  )
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

  if (!target || typeof document === "undefined") return null

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
    const selected = selectedIds.has(proxy.spell.index)
    if (!selected) {
      const isCantrip = proxy.spell.slotLevel === 0
      const current = isCantrip ? cantripCount : leveledCount
      const limit = isCantrip ? target!.maxCantrips : target!.maxLeveled
      if (current >= limit) {
        setErrorMessage(
          isCantrip
            ? `O limite de ${limit} truques já foi atingido.`
            : `O limite de ${limit} magias já foi atingido.`,
        )
        return
      }
    }

    setErrorMessage("")
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
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={target.title}
      onMouseDown={close}
    >
      <section
        className="grid max-h-[94dvh] w-full max-w-6xl grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-textH">{target.title}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-textMuted">
              <Badge label={`Truques ${cantripCount}/${target.maxCantrips}`} />
              {target.fullPreparedList ? (
                <Badge label="Magias de nível: lista completa da classe" />
              ) : (
                <Badge label={`Magias ${leveledCount}/${target.maxLeveled}`} />
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={close}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
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
          <SharedSelect
            className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
            value={levelFilter}
            disabled={target.fullPreparedList}
            onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
          >
            <option value="all">Todos os níveis</option>
            <option value="cantrip">Truques</option>
            {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
              <option key={level} value={level}>{level}º nível</option>
            ))}
          </SharedSelect>
          <SharedSelect
            className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
            value={schoolFilter}
            onChange={(event) => setSchoolFilter(event.target.value)}
          >
            <option value="all">Todas as escolas</option>
            {schools.map((school) => (
              <option key={school.value} value={school.value}>{school.label}</option>
            ))}
          </SharedSelect>
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
          {target.fullPreparedList ? (
            <div className="mb-4 rounded-xl border border-accentBorder bg-accentBg p-3 text-sm text-textH">
              Esta classe conhece toda a lista de magias de nível disponível. Selecione apenas os truques; as magias preparadas podem ser alteradas posteriormente na ficha.
            </div>
          ) : null}
          {errorMessage ? (
            <div className="mb-4 rounded-xl border border-danger bg-dangerBg p-3 text-sm text-danger">
              {errorMessage}
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((proxy) => {
              const selected = selectedIds.has(proxy.spell.index)
              const prepared = preparedIds.has(proxy.spell.index)
              return (
                <article
                  key={proxy.spell.index}
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
                        <div className="font-semibold text-textH">{spellLabel(proxy.spell)}</div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Badge label={proxy.spell.slotLevel === 0 ? "Truque" : `${proxy.spell.slotLevel}º nível`} />
                          <Badge label={MAGIC_SCHOOLS_MAP[proxy.spell.school] ?? String(proxy.spell.school)} />
                          {proxy.spell.concentration ? <Badge label="Concentração" /> : null}
                          {proxy.spell.ritual ? <Badge label="Ritual" /> : null}
                        </div>
                      </div>
                      {selected ? <Check className="h-4 w-4 text-textH" /> : null}
                    </div>
                    <p className="mt-3 text-xs leading-5 text-textMuted">
                      {proxy.spell.description || "Sem descrição cadastrada."}
                    </p>
                  </button>
                  {proxy.checkbox && selected && proxy.spell.slotLevel > 0 ? (
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
        </main>

        <footer className="flex justify-end border-t border-border p-4 sm:p-5">
          <Button onClick={close}>Concluir seleção</Button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function parseTarget(element: HTMLDetailsElement): Target | undefined {
  const raw = element.querySelector(":scope > summary")?.textContent?.trim() ?? ""
  const normalized = normalize(raw)
  if (!normalized.startsWith("selecionar e ler magias de")) return undefined
  const limits = raw.match(/truques\s+\d+\/(\d+)\s*·\s*magias\s+\d+\/(\d+)/i)
  const fullPreparedList = FULL_LIST_CLASSES.some((className) =>
    normalized.includes(className),
  )
  return {
    element,
    title: raw.split("·")[0]?.trim() || "Selecionar magias",
    maxCantrips: Number(limits?.[1]) || 0,
    maxLeveled: fullPreparedList ? 0 : Number(limits?.[2]) || 0,
    fullPreparedList,
  }
}

function parseSpellProxies(
  element: HTMLDetailsElement,
  spells: Spell[],
  fullPreparedList: boolean,
): SpellProxy[] {
  const spellMap = buildSpellMap(spells)
  return Array.from(element.querySelectorAll<HTMLElement>("article")).flatMap<SpellProxy>((article) => {
    const button = article.querySelector<HTMLButtonElement>("button")
    const title = article.querySelector<HTMLElement>("strong")?.textContent?.trim()
    if (!button || !title) return []
    const spell = resolveSpell(spellMap, title)
    if (!spell || (fullPreparedList && spell.slotLevel > 0)) return []
    const checkbox = article.querySelector<HTMLInputElement>('input[type="checkbox"]') ?? undefined
    return [{
      spell,
      button,
      checkbox,
      selected:
        article.classList.contains("bg-accentBg") ||
        button.getAttribute("aria-pressed") === "true",
      prepared: checkbox?.checked ?? false,
    }]
  })
}

function buildSpellMap(spells: Spell[]): Map<string, Spell> {
  const map = new Map<string, Spell>()
  for (const spell of spells) {
    map.set(normalize(spell.index), spell)
    map.set(normalize(spell.name), spell)
    if (spell.displayName?.trim()) map.set(normalize(spell.displayName), spell)
  }
  return map
}

function resolveSpell(map: Map<string, Spell>, value: string): Spell | undefined {
  return map.get(normalize(value)) ?? map.get(normalize(toIndex(value)))
}

function toIndex(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLocaleLowerCase("en-US")
}

function spellLabel(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {label}
    </span>
  )
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}