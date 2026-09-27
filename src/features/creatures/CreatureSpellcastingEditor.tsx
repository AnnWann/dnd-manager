import { useEffect, useMemo, useState } from "react"
import { Plus, Search, Trash2, X } from "lucide-react"

import {
  getOfficialSpell,
  queryOfficialSpells,
  type SpellCompendiumSummary,
} from "../../api/spell-compendium"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Select } from "../../components/ui/Select"
import { useMagicContext } from "../../contexts/magicContext"
import {
  getCreatureSpellAttackBonus,
  getCreatureSpellSaveDc,
  type CompendiumCreature,
  type CreatureSpellReference,
  type CreatureSpellcasting,
} from "../../models/creatures/CompendiumCreature"
import type { Spell } from "../../models/magic/spells/Spell"
import type { Attribute } from "../../models/sheet/Attribute"

type PickerSpell = Spell | SpellCompendiumSummary

const ATTRIBUTES: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]

export function CreatureSpellcastingEditor({
  creature,
  onChange,
}: {
  creature: CompendiumCreature
  onChange: (spellcasting?: CreatureSpellcasting) => void
}) {
  const { getSpellByIndex, ensureOfficialSpells } = useMagicContext()
  const [pickerOpen, setPickerOpen] = useState(false)
  const enabled = Boolean(creature.spellcasting)
  const value: CreatureSpellcasting = creature.spellcasting ?? {
    ability: "cha",
    slots: {},
    spells: [],
  }

  useEffect(() => {
    if (!value.spells.length) return
    void ensureOfficialSpells(value.spells.map((entry) => entry.spellIndex))
  }, [ensureOfficialSpells, value.spells])

  function patch(patchValue: Partial<CreatureSpellcasting>) {
    onChange({ ...value, ...patchValue })
  }

  function updateSpell(index: number, patchValue: Partial<CreatureSpellReference>) {
    patch({
      spells: value.spells.map((entry, currentIndex) =>
        currentIndex === index ? { ...entry, ...patchValue } : entry,
      ),
    })
  }

  function addSpell(spell: Spell) {
    if (value.spells.some((entry) => entry.spellIndex === spell.index)) {
      setPickerOpen(false)
      return
    }

    const usage: CreatureSpellReference["usage"] =
      spell.slotLevel === 0
        ? { type: "atWill" }
        : Object.keys(value.slots).length > 0
          ? { type: "slots" }
          : { type: "perDay", uses: 1 }

    patch({
      spells: [
        ...value.spells,
        {
          spellIndex: spell.index,
          usage,
          castLevel: usage.type === "slots" ? undefined : spell.slotLevel,
        },
      ],
    })
    setPickerOpen(false)
  }

  const automaticDc = getCreatureSpellSaveDc({
    ...creature,
    spellcasting: { ...value, saveDc: undefined },
  })
  const automaticAttack = getCreatureSpellAttackBonus({
    ...creature,
    spellcasting: { ...value, attackBonus: undefined },
  })

  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-textH">Conjuração</h3>
            {enabled ? (
              <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                Ativa
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-textMuted">
            Magias de criatura usam uma CD e bônus de ataque próprios. Cada magia pode ser à vontade,
            limitada por dia ou consumir os espaços compartilhados da criatura.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-textH">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) =>
              onChange(event.target.checked ? value : undefined)
            }
          />
          Criatura conjuradora
        </label>
      </div>

      {enabled ? (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="grid gap-1.5 text-xs font-medium text-textH">
              Atributo de conjuração
              <Select
                value={value.ability}
                onChange={(event) =>
                  patch({ ability: event.target.value as Attribute })
                }
              >
                {ATTRIBUTES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-textH">
              CD das magias
              <Input
                type="number"
                value={value.saveDc ?? ""}
                placeholder={String(automaticDc ?? 10)}
                onChange={(event) =>
                  patch({
                    saveDc: optionalNumber(event.target.value),
                  })
                }
              />
              <span className="text-[10px] font-normal text-textMuted">
                Vazio = automático ({automaticDc ?? "—"}) por ND + atributo.
              </span>
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-textH">
              Ataque mágico
              <Input
                type="number"
                value={value.attackBonus ?? ""}
                placeholder={signed(automaticAttack)}
                onChange={(event) =>
                  patch({
                    attackBonus: optionalNumber(event.target.value),
                  })
                }
              />
              <span className="text-[10px] font-normal text-textMuted">
                Vazio = automático ({signed(automaticAttack)}) por ND + atributo.
              </span>
            </label>
          </div>

          <div className="rounded-lg border border-border bg-bg p-3">
            <div>
              <div className="text-xs font-semibold text-textH">Espaços de magia</div>
              <p className="mt-0.5 text-[11px] text-textMuted">
                Compartilhados entre as magias marcadas como “Usa espaços”. Deixe todos em 0 para conjuração apenas inata/por dia.
              </p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {Array.from({ length: 9 }, (_, index) => index + 1).map((level) => (
                <label key={level} className="grid gap-1 text-center text-[10px] font-medium text-textMuted">
                  {level}º
                  <Input
                    type="number"
                    min={0}
                    className="text-center"
                    value={value.slots[level as keyof CreatureSpellcasting["slots"]] ?? 0}
                    onChange={(event) => {
                      const amount = Math.max(
                        0,
                        Math.trunc(Number(event.target.value) || 0),
                      )
                      const slots = { ...value.slots }
                      if (amount > 0) {
                        slots[level as keyof CreatureSpellcasting["slots"]] = amount
                      } else {
                        delete slots[level as keyof CreatureSpellcasting["slots"]]
                      }
                      patch({ slots })
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-bg p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-textH">Magias conhecidas</div>
                <p className="mt-0.5 text-[11px] text-textMuted">
                  Referências diretas ao compêndio de magias; alterações na magia são refletidas aqui.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
                <Plus className="h-4 w-4" />
                Adicionar magia
              </Button>
            </div>

            {value.spells.length ? (
              <div className="mt-3 grid gap-2">
                {value.spells.map((entry, index) => {
                  const spell = getSpellByIndex(entry.spellIndex)
                  const usageType = entry.usage.type
                  const minimumLevel = spell?.slotLevel ?? 0

                  return (
                    <div
                      key={entry.spellIndex}
                      className="grid gap-3 rounded-lg border border-border bg-bg-subtle p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-textH">
                            {spell?.displayName || spell?.name || entry.spellIndex}
                          </div>
                          <div className="mt-0.5 text-[11px] text-textMuted">
                            {spell
                              ? spell.slotLevel === 0
                                ? "Truque"
                                : `${spell.slotLevel}º círculo`
                              : "Magia ainda não carregada"}
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remover magia"
                          onClick={() =>
                            patch({
                              spells: value.spells.filter(
                                (_, currentIndex) => currentIndex !== index,
                              ),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4 text-danger" />
                        </Button>
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="grid gap-1 text-[11px] font-medium text-textH">
                          Uso
                          <Select
                            value={usageType}
                            onChange={(event) => {
                              const type = event.target.value as CreatureSpellReference["usage"]["type"]
                              updateSpell(index, {
                                usage:
                                  type === "perDay"
                                    ? { type, uses: entry.usage.type === "perDay" ? entry.usage.uses : 1 }
                                    : type === "slots"
                                      ? { type }
                                      : { type: "atWill" },
                                castLevel:
                                  type === "slots"
                                    ? undefined
                                    : Math.max(minimumLevel, entry.castLevel ?? minimumLevel),
                              })
                            }}
                          >
                            <option value="atWill">À vontade</option>
                            <option value="perDay">Usos por dia</option>
                            <option value="slots">Usa espaços</option>
                          </Select>
                        </label>

                        {entry.usage.type === "perDay" ? (
                          <label className="grid gap-1 text-[11px] font-medium text-textH">
                            Usos por dia
                            <Input
                              type="number"
                              min={1}
                              value={entry.usage.uses}
                              onChange={(event) =>
                                updateSpell(index, {
                                  usage: {
                                    type: "perDay",
                                    uses: Math.max(
                                      1,
                                      Math.trunc(Number(event.target.value) || 1),
                                    ),
                                  },
                                })
                              }
                            />
                          </label>
                        ) : entry.usage.type !== "slots" && minimumLevel > 0 ? (
                          <label className="grid gap-1 text-[11px] font-medium text-textH">
                            Círculo de conjuração
                            <Input
                              type="number"
                              min={minimumLevel}
                              max={9}
                              value={entry.castLevel ?? minimumLevel}
                              onChange={(event) =>
                                updateSpell(index, {
                                  castLevel: Math.max(
                                    minimumLevel,
                                    Math.min(
                                      9,
                                      Math.trunc(Number(event.target.value) || minimumLevel),
                                    ),
                                  ),
                                })
                              }
                            />
                          </label>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-dashed border-border p-5 text-center text-xs text-textMuted">
                Nenhuma magia adicionada.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <CreatureSpellPicker
        open={pickerOpen}
        excludedIndexes={new Set(value.spells.map((entry) => entry.spellIndex))}
        onClose={() => setPickerOpen(false)}
        onSelect={addSpell}
      />
    </section>
  )
}

function CreatureSpellPicker({
  open,
  excludedIndexes,
  onClose,
  onSelect,
}: {
  open: boolean
  excludedIndexes: Set<string>
  onClose: () => void
  onSelect: (spell: Spell) => void
}) {
  const { savedSpells } = useMagicContext()
  const [search, setSearch] = useState("")
  const [level, setLevel] = useState("all")
  const [officialSpells, setOfficialSpells] = useState<SpellCompendiumSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [selectingIndex, setSelectingIndex] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true)
      setError("")
      void queryOfficialSpells({
        q: search.trim() || undefined,
        level: level === "all" ? undefined : Number(level),
        page: 1,
        pageSize: 100,
      })
        .then((page) => {
          if (!cancelled) setOfficialSpells(page.spells)
        })
        .catch(() => {
          if (!cancelled) {
            setOfficialSpells([])
            setError("Não foi possível consultar o compêndio oficial.")
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [level, open, search])

  const spells = useMemo<PickerSpell[]>(() => {
    const normalized = normalize(search)
    const homebrew = savedSpells
      .filter((spell) => spell.homebrew)
      .filter((spell) => !excludedIndexes.has(spell.index))
      .filter((spell) =>
        (!normalized ||
          normalize(spell.displayName || spell.name).includes(normalized)) &&
        (level === "all" || spell.slotLevel === Number(level)),
      )

    return [
      ...officialSpells.filter((spell) => !excludedIndexes.has(spell.index)),
      ...homebrew,
    ]
      .sort((left, right) =>
        left.slotLevel !== right.slotLevel
          ? left.slotLevel - right.slotLevel
          : (left.displayName || left.name).localeCompare(
              right.displayName || right.name,
              "pt-BR",
            ),
      )
      .slice(0, 100)
  }, [excludedIndexes, level, officialSpells, savedSpells, search])

  if (!open) return null

  function close() {
    setSearch("")
    setLevel("all")
    setError("")
    onClose()
  }

  async function select(spell: PickerSpell) {
    if (isFullSpell(spell)) {
      onSelect(spell)
      return
    }

    setSelectingIndex(spell.index)
    setError("")
    try {
      onSelect(await getOfficialSpell(spell.index))
    } catch {
      setError("Não foi possível carregar os detalhes desta magia.")
    } finally {
      setSelectingIndex("")
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-textH">Adicionar magia à criatura</h2>
            <p className="mt-1 text-xs text-textMuted">
              Magias oficiais e homebrew do compêndio da campanha.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
            onClick={close}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[1fr_150px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              autoFocus
              className="pl-9"
              value={search}
              placeholder="Buscar magia..."
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <Select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="all">Todos os círculos</option>
            <option value="0">Truques</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
              <option key={value} value={value}>
                {value}º círculo
              </option>
            ))}
          </Select>
        </div>

        {error ? (
          <div className="border-b border-border px-4 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}
        {loading ? (
          <div className="border-b border-border px-4 py-2 text-xs text-textMuted">
            Consultando magias...
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-4">
          {spells.length ? (
            spells.map((spell) => (
              <button
                key={spell.index}
                type="button"
                disabled={Boolean(selectingIndex)}
                className="rounded-lg border border-border bg-bg p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg disabled:opacity-60"
                onClick={() => void select(spell)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-textH">
                    {spell.displayName || spell.name}
                  </span>
                  <span className="text-[11px] text-textMuted">
                    {selectingIndex === spell.index
                      ? "Carregando..."
                      : spell.slotLevel === 0
                        ? "Truque"
                        : `${spell.slotLevel}º círculo`}
                  </span>
                </div>
                {spell.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                    {spell.description}
                  </p>
                ) : null}
              </button>
            ))
          ) : !loading ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-textMuted">
              Nenhuma magia encontrada.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function isFullSpell(spell: PickerSpell): spell is Spell {
  return "higherLevelText" in spell && "effects" in spell
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function signed(value: number | undefined): string {
  if (value === undefined) return "—"
  return value >= 0 ? `+${value}` : String(value)
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
}
