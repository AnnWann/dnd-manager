import { useMemo, useState } from "react"
import { Plus, Search, Trash2, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { useMagicContext } from "../../../contexts/magicContext"
import type { AbilityUsageResetKind, Usage } from "../../../models/abilities/Ability"
import type { Spell, SpellResourceType } from "../../../models/magic/spells/Spell"
import type {
  SpellGrant,
  SpellGrantCastingMode,
} from "../../../models/magic/spells/SpellGrant"
import type { Attribute } from "../../../models/sheet/Attribute"

export type EditableSpellGrant = SpellGrant & {
  usage?: Usage
}

type Props = {
  grants: EditableSpellGrant[]
  onChange: (grants: EditableSpellGrant[]) => void
  variant: "ability" | "equipment"
  abilityHasUsage?: boolean
}

const ATTRIBUTE_OPTIONS: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "FOR" },
  { value: "dex", label: "DES" },
  { value: "con", label: "CON" },
  { value: "int", label: "INT" },
  { value: "wis", label: "SAB" },
  { value: "cha", label: "CAR" },
]

const RESOURCE_OPTIONS: Array<{ value: SpellResourceType; label: string }> = [
  { value: "ki", label: "Ki" },
  { value: "sorceryPoints", label: "Pontos de feitiçaria" },
  { value: "channelDivinity", label: "Canalizar Divindade" },
]

const RESET_OPTIONS: Array<{
  value: AbilityUsageResetKind
  label: string
}> = [
  { value: "shortRest", label: "Descanso curto" },
  { value: "longRest", label: "Descanso longo" },
  { value: "limited", label: "Não restaura" },
]

export function GrantedSpellsEditor({
  grants,
  onChange,
  variant,
  abilityHasUsage = false,
}: Props) {
  const { getSpellByIndex } = useMagicContext()
  const [pickerOpen, setPickerOpen] = useState(false)

  function addSpell(spell: Spell) {
    if (grants.some((grant) => grant.index === spell.index)) {
      setPickerOpen(false)
      return
    }

    const nextGrant: EditableSpellGrant = {
      index: spell.index,
      castingMode: "source",
      attribute: "cha",
      ...(variant === "equipment"
        ? {
            usage: {
              max: 1,
              used: 0,
              reset: "longRest" as const,
            },
          }
        : {}),
    }

    onChange([...grants, nextGrant])
    setPickerOpen(false)
  }

  function updateGrant(
    index: number,
    patch: Partial<EditableSpellGrant>,
  ) {
    onChange(
      grants.map((grant, currentIndex) => {
        if (currentIndex !== index) return grant

        const nextGrant = {
          ...grant,
          ...patch,
        }

        if (variant !== "equipment") return nextGrant

        if (nextGrant.castingMode === "known") {
          return {
            ...nextGrant,
            usage: {
              max: 1,
              used: 0,
              reset: "spellSlot" as const,
            },
          }
        }

        if (!nextGrant.usage || nextGrant.usage.reset === "spellSlot") {
          return {
            ...nextGrant,
            usage: {
              max: 1,
              used: 0,
              reset: "longRest" as const,
            },
          }
        }

        return nextGrant
      }),
    )
  }

  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold text-textH">Magias concedidas</div>
          <p className="mt-0.5 text-[11px] leading-4 text-textMuted">
            Escolha a magia, como ela é acessada e, se necessário, qual recurso paga a conjuração.
          </p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" /> Magia
        </Button>
      </div>

      {grants.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg px-3 py-4 text-center text-xs text-textMuted">
          Nenhuma magia concedida.
        </div>
      ) : (
        <div className="grid gap-2">
          {grants.map((grant, index) => {
            const spell = getSpellByIndex(grant.index)
            const castingMode = grant.castingMode ?? "source"
            const usage = grant.usage
            const alternateResource = grant.resourceCost

            return (
              <div key={`${grant.index}-${index}`} className="grid gap-3 rounded-lg border border-border bg-bg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-textH">
                      {spell?.displayName || spell?.name || grant.index}
                    </div>
                    <div className="mt-0.5 text-[11px] text-textMuted">
                      {spell ? (spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º círculo`) : "Magia não encontrada no catálogo"}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Remover magia concedida"
                    onClick={() => onChange(grants.filter((_, currentIndex) => currentIndex !== index))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-textMuted transition-colors hover:bg-dangerBg hover:text-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-[11px] font-medium text-textMuted">Forma de acesso</span>
                    <Select
                      value={castingMode}
                      onChange={(event) => updateGrant(index, {
                        castingMode: event.target.value as SpellGrantCastingMode,
                        resourceCost: event.target.value === "known" ? undefined : grant.resourceCost,
                      })}
                    >
                      <option value="source">Apenas pela origem</option>
                      <option value="known">Aprende e usa espaços normais</option>
                    </Select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-[11px] font-medium text-textMuted">Atributo de conjuração</span>
                    <Select value={grant.attribute ?? "cha"} onChange={(event) => updateGrant(index, { attribute: event.target.value as Attribute })}>
                      {ATTRIBUTE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </Select>
                  </label>
                </div>

                {variant === "ability" && castingMode === "source" ? (
                  <div className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-3">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-medium text-textMuted">Recurso ao conjurar</span>
                      <Select
                        value={alternateResource?.resource ?? "ability"}
                        onChange={(event) => {
                          if (event.target.value === "ability") {
                            updateGrant(index, { resourceCost: undefined })
                            return
                          }
                          updateGrant(index, {
                            resourceCost: {
                              resource: event.target.value as SpellResourceType,
                              amount: Math.max(1, alternateResource?.amount ?? 1),
                            },
                          })
                        }}
                      >
                        <option value="ability">Recurso/carga da habilidade</option>
                        {RESOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                    </label>

                    {alternateResource ? (
                      <label className="grid gap-1 md:max-w-48">
                        <span className="text-[11px] font-medium text-textMuted">Custo base</span>
                        <Input
                          type="number"
                          min={1}
                          value={alternateResource.amount}
                          onChange={(event) => updateGrant(index, {
                            resourceCost: {
                              ...alternateResource,
                              amount: Math.max(1, Math.trunc(Number(event.target.value) || 1)),
                            },
                          })}
                        />
                        <span className="text-[10px] leading-4 text-textMuted">
                          Ao fazer upcast, o custo aumenta em 1 por círculo acima do nível base.
                        </span>
                      </label>
                    ) : (
                      <div className="text-[11px] text-textMuted">
                        {abilityHasUsage
                          ? "A magia usa o contador da própria habilidade."
                          : "Sem contador próprio, a origem não limita quantas vezes a magia pode ser usada."}
                      </div>
                    )}
                  </div>
                ) : null}

                {variant === "equipment" && castingMode === "source" ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-[11px] font-medium text-textMuted">Cargas máximas</span>
                      <Input
                        type="number"
                        min={1}
                        value={usage?.max ?? 1}
                        onChange={(event) => {
                          const max = Math.max(1, Math.trunc(Number(event.target.value) || 1))
                          updateGrant(index, { usage: { max, used: Math.min(usage?.used ?? 0, max), reset: usage?.reset ?? "longRest" } })
                        }}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-[11px] font-medium text-textMuted">Recuperação</span>
                      <Select
                        value={usage?.reset ?? "longRest"}
                        onChange={(event) => updateGrant(index, {
                          usage: { max: usage?.max ?? 1, used: usage?.used ?? 0, reset: event.target.value as AbilityUsageResetKind },
                        })}
                      >
                        {RESET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                    </label>
                  </div>
                ) : null}

                {castingMode === "known" ? (
                  <div className="rounded-lg bg-accentBg px-3 py-2 text-[11px] text-textH">
                    Esta magia aparecerá na lista de magias do personagem e poderá usar espaços normais de magia.
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}

      <SpellPickerDialog
        open={pickerOpen}
        excludedIndexes={new Set(grants.map((grant) => grant.index))}
        onClose={() => setPickerOpen(false)}
        onSelect={addSpell}
      />
    </section>
  )
}

function SpellPickerDialog({
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
  const { spells } = useMagicContext()
  const [search, setSearch] = useState("")
  const [level, setLevel] = useState("all")

  const filteredSpells = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return spells
      .filter((spell) => !excludedIndexes.has(spell.index))
      .filter((spell) => {
        const matchesSearch = !normalizedSearch || spell.name.toLocaleLowerCase().includes(normalizedSearch) || spell.displayName?.toLocaleLowerCase().includes(normalizedSearch)
        const matchesLevel = level === "all" || spell.slotLevel === Number(level)
        return matchesSearch && matchesLevel
      })
      .sort((left, right) => left.slotLevel !== right.slotLevel ? left.slotLevel - right.slotLevel : (left.displayName || left.name).localeCompare(right.displayName || right.name, "pt-BR"))
      .slice(0, 100)
  }, [excludedIndexes, level, search, spells])

  if (!open) return null

  function close() {
    setSearch("")
    setLevel("all")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={close}>
      <div role="dialog" aria-modal="true" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-theme-lg" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold text-textH">Selecionar magia</h2>
            <p className="mt-1 text-xs text-textMuted">Magias oficiais e homebrew disponíveis no módulo de Magia.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={close} className="flex h-9 w-9 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[1fr_150px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input autoFocus className="pl-9" value={search} placeholder="Buscar magia por nome..." onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="all">Todos os círculos</option>
            <option value="0">Truques</option>
            {[1,2,3,4,5,6,7,8,9].map((value) => <option key={value} value={value}>{value}º círculo</option>)}
          </Select>
        </div>

        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto p-4">
          {filteredSpells.length > 0 ? filteredSpells.map((spell) => (
            <button key={spell.index} type="button" onClick={() => onSelect(spell)} className="rounded-lg border border-border bg-bg p-3 text-left transition-colors hover:border-accentBorder hover:bg-accentBg">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-textH">{spell.displayName || spell.name}</span>
                <span className="text-[11px] text-textMuted">{spell.slotLevel === 0 ? "Truque" : `${spell.slotLevel}º círculo`}</span>
              </div>
              {spell.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">{spell.description}</p> : null}
            </button>
          )) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-textMuted">Nenhuma magia encontrada.</div>
          )}
        </div>
      </div>
    </div>
  )
}
