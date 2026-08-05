import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { createCurrencyItem } from "../../../models/items/Currency"
import type { Itemmable } from "../../../models/items/item"
import { getClassNamePt } from "../../../models/leveling/ClassLocalization"
import type { ClassName } from "../../../models/sheet/Class"
import { ItemCreationDialog } from "../../items/ItemCreationDialog"
import {
  STANDARD_ITEM_DEFINITIONS,
  instantiateStandardItem,
  normalizeStandardItem,
} from "../../items/standardItemCompendium"
import {
  averageStartingGold,
  formatStartingGoldFormula,
  getDefaultClassEquipmentSelections,
  getPhbClassEquipmentPreset,
  getSelectedClassEquipment,
  rollStartingGold,
  type StartingItemSpec,
} from "./phbClassEquipment"
import { matchesPhbWeaponCategory } from "./phbWeaponCategory"
import { createStartingInventoryItem } from "./startingEquipmentItems"

type EquipmentMode = "equipment" | "gold"

type EquipmentOverride = {
  className: ClassName
  mode: EquipmentMode
  items: Itemmable[]
  gold: number
  valid: boolean
  error?: string
}

type Props = {
  onChange: (override: EquipmentOverride | null) => void
}

const CLASS_LABELS = new Map<ClassName, string>(
  ([
    "artificer",
    "barbarian",
    "bard",
    "cleric",
    "druid",
    "fighter",
    "monk",
    "paladin",
    "ranger",
    "rogue",
    "sorcerer",
    "warlock",
    "wizard",
  ] as ClassName[]).map((className) => [className, getClassNamePt(className)]),
)

export function CharacterCreationEquipmentChoices({ onChange }: Props) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [className, setClassName] = useState<ClassName | null>(null)

  useEffect(() => {
    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
          (entry) => entry.textContent?.trim().startsWith("Equipamento de nível 1 de"),
        )
        if (!heading) {
          setAnchor(null)
          return
        }
        const section = heading.closest<HTMLElement>("section")
        if (!section) return
        const label = heading.textContent?.replace("Equipamento de nível 1 de", "").trim() ?? ""
        const resolved = Array.from(CLASS_LABELS.entries()).find(([, value]) => value === label)?.[0]
        if (!resolved) return

        let portalAnchor = section.previousElementSibling
        if (!(portalAnchor instanceof HTMLElement) || portalAnchor.dataset.classEquipmentChoiceAnchor !== "true") {
          portalAnchor = document.createElement("div")
          portalAnchor.dataset.classEquipmentChoiceAnchor = "true"
          section.parentElement?.insertBefore(portalAnchor, section)
        }
        section.style.display = "none"
        setClassName(resolved)
        setAnchor(portalAnchor)
      })
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.querySelectorAll<HTMLElement>("[data-class-equipment-choice-anchor]").forEach((entry) => entry.remove())
      document.querySelectorAll<HTMLElement>("section").forEach((section) => {
        if (section.querySelector("h2")?.textContent?.trim().startsWith("Equipamento de nível 1 de")) {
          section.style.display = ""
        }
      })
    }
  }, [])

  if (!anchor || !className) return null
  return createPortal(
    <ClassEquipmentConfigurator key={className} className={className} onChange={onChange} />,
    anchor,
  )
}

function ClassEquipmentConfigurator({
  className,
  onChange,
}: {
  className: ClassName
  onChange: Props["onChange"]
}) {
  const preset = getPhbClassEquipmentPreset(className)
  const [mode, setMode] = useState<EquipmentMode>("equipment")
  const [selections, setSelections] = useState<Record<string, string>>(
    getDefaultClassEquipmentSelections(className),
  )
  const [genericWeapons, setGenericWeapons] = useState<Record<string, Itemmable>>({})
  const [gold, setGold] = useState(averageStartingGold(preset.startingGold))
  const [weaponPicker, setWeaponPicker] = useState<{
    key: string
    category: "simple" | "martial"
  } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const latestOverride = useRef<EquipmentOverride | null>(null)

  const selectedSpecs = useMemo(
    () => getSelectedClassEquipment(className, selections),
    [className, selections],
  )
  const unresolvedWeapons = useMemo(
    () => selectedSpecs.filter(isGenericWeapon).filter((spec) => !genericWeapons[spec.id]),
    [genericWeapons, selectedSpecs],
  )

  const items = useMemo(() => {
    if (mode === "gold") {
      return [
        normalizeStandardItem({
          ...createCurrencyItem("gold", gold, `starting-gold-${className}`),
          notes: `Ouro inicial de ${getClassNamePt(className)}.`,
        }),
      ]
    }

    return selectedSpecs.map((spec) => {
      const generic = genericWeapons[spec.id]
      const item = generic ?? createStartingInventoryItem(spec)
      return normalizeStandardItem({
        ...item,
        id: generic?.id ?? `starting-${className}-${spec.id}`,
        notes: mergeNotes(item.notes, `Equipamento inicial da classe ${getClassNamePt(className)}.`),
      })
    })
  }, [className, genericWeapons, gold, mode, selectedSpecs])

  const valid = mode === "gold" || unresolvedWeapons.length === 0
  const override = useMemo<EquipmentOverride>(
    () => ({
      className,
      mode,
      items,
      gold,
      valid,
      error: valid
        ? undefined
        : "Escolha uma arma concreta para cada entrada de arma simples ou marcial.",
    }),
    [className, gold, items, mode, valid],
  )

  useEffect(() => {
    latestOverride.current = override
    onChange(override)
  }, [onChange, override])

  useEffect(
    () => () => {
      if (latestOverride.current?.className === className) onChange(null)
    },
    [className, onChange],
  )

  function setChoice(groupId: string, optionId: string) {
    setSelections((current) => ({ ...current, [groupId]: optionId }))
  }

  return (
    <section
      data-creation-step-valid={valid ? "true" : "false"}
      data-creation-step-error={override.error ?? ""}
      className="grid gap-5 rounded-xl border border-border bg-bg-subtle p-4"
    >
      <header>
        <h2 className="font-semibold text-textH">
          Equipamento de nível 1 de {getClassNamePt(className)}
        </h2>
        <p className="mt-1 text-xs leading-5 text-textMuted">
          Escolha uma opção de cada grupo ou substitua o pacote pelo ouro inicial.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={mode === "equipment"}
          title="Equipamento inicial"
          description="Escolha uma opção de cada grupo e resolva todas as armas genéricas."
          onClick={() => setMode("equipment")}
        />
        <ChoiceCard
          selected={mode === "gold"}
          title="Ouro inicial"
          description={`${formatStartingGoldFormula(preset.startingGold)} em vez do equipamento.`}
          onClick={() => setMode("gold")}
        />
      </div>

      {mode === "gold" ? (
        <section className="rounded-xl border border-accentBorder bg-accentBg p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-textH">Ouro inicial</div>
              <div className="mt-1 text-xs text-textMuted">
                Fórmula: {formatStartingGoldFormula(preset.startingGold)}. Média: {averageStartingGold(preset.startingGold)} PO.
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-textMuted">
                Peças de ouro
                <Input
                  className="w-28"
                  type="number"
                  min={0}
                  value={gold}
                  onChange={(event) => setGold(Math.max(0, Math.trunc(Number(event.target.value) || 0)))}
                />
              </label>
              <Button variant="secondary" onClick={() => setGold(rollStartingGold(preset.startingGold))}>
                Rolar {formatStartingGoldFormula(preset.startingGold)}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-4">
          {preset.choiceGroups.map((choiceGroup) => {
            const selectedOption = choiceGroup.options.find(
              (entry) => entry.id === selections[choiceGroup.id],
            ) ?? choiceGroup.options[0]
            return (
              <section key={choiceGroup.id} className="rounded-xl border border-border bg-bg p-4">
                <div className="text-sm font-semibold text-textH">{choiceGroup.label}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {choiceGroup.options.map((entry) => (
                    <ChoiceCard
                      key={entry.id}
                      selected={selectedOption?.id === entry.id}
                      title={entry.label}
                      description={entry.items.map(formatSpec).join(" · ")}
                      onClick={() => setChoice(choiceGroup.id, entry.id)}
                    />
                  ))}
                </div>

                {(selectedOption?.items ?? []).filter(isGenericWeapon).map((spec) => {
                  const current = genericWeapons[spec.id]
                  const category = isMartialPlaceholder(spec) ? "martial" : "simple"
                  return (
                    <div key={spec.id} className="mt-3 flex flex-col gap-2 rounded-lg border border-warning bg-warningBg p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-xs font-semibold text-textH">Escolha obrigatória: {spec.name}</div>
                        <div className="mt-1 text-xs text-textMuted">
                          {current ? `Selecionada: ${current.name}` : "Nenhuma arma selecionada."}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setWeaponPicker({ key: spec.id, category })}
                        >
                          Escolher arma
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setWeaponPicker({ key: spec.id, category })
                            setCustomOpen(true)
                          }}
                        >
                          Criar arma personalizada
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </section>
            )
          })}

          {preset.fixedItems.length ? (
            <section className="rounded-xl border border-border bg-bg p-4">
              <div className="text-sm font-semibold text-textH">Itens fixos</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {preset.fixedItems.map((spec) => (
                  <span key={spec.id} className="rounded-full border border-accentBorder bg-accentBg px-3 py-1 text-xs text-textH">
                    {formatSpec(spec)}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {!valid ? (
        <div className="rounded-lg border border-danger bg-dangerBg p-3 text-xs text-danger">
          {override.error}
        </div>
      ) : null}

      {weaponPicker && !customOpen ? (
        <WeaponPicker
          category={weaponPicker.category}
          current={genericWeapons[weaponPicker.key]}
          onClose={() => setWeaponPicker(null)}
          onSelect={(item) => {
            setGenericWeapons((current) => ({ ...current, [weaponPicker.key]: item }))
            setWeaponPicker(null)
          }}
        />
      ) : null}

      <ItemCreationDialog
        open={customOpen}
        title="Criar arma inicial personalizada"
        onClose={() => {
          setCustomOpen(false)
          setWeaponPicker(null)
        }}
        onSave={(item) => {
          if (weaponPicker) {
            setGenericWeapons((current) => ({ ...current, [weaponPicker.key]: item }))
          }
          setCustomOpen(false)
          setWeaponPicker(null)
        }}
      />
    </section>
  )
}

function WeaponPicker({
  category,
  current,
  onClose,
  onSelect,
}: {
  category: "simple" | "martial"
  current?: Itemmable
  onClose: () => void
  onSelect: (item: Itemmable) => void
}) {
  const [query, setQuery] = useState("")
  const definitions = useMemo(() => {
    const normalized = normalize(query)
    return STANDARD_ITEM_DEFINITIONS.filter((definition) => {
      const item = definition.item
      if (!(item.kind === "equipment" && item.equipSlot === "weapon")) return false
      if (!matchesPhbWeaponCategory(item, category)) return false
      return !normalized || normalize(`${item.name} ${item.desc ?? ""}`).includes(normalized)
    })
  }, [category, query])

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <section className="grid max-h-[90dvh] w-full max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="font-semibold text-textH">
              Escolher arma {category === "martial" ? "marcial" : "simples"}
            </h2>
            <p className="mt-1 text-xs text-textMuted">Somente armas válidas para esta categoria são exibidas.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>Fechar</Button>
        </header>
        <div className="border-b border-border p-4">
          <Input value={query} placeholder="Buscar arma" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <div className="grid gap-2 overflow-y-auto p-4 sm:grid-cols-2">
          {definitions.map((definition) => {
            const selected = current?.compendiumItemId === definition.item.id
            return (
              <button
                key={definition.item.id}
                type="button"
                onClick={() => onSelect(instantiateStandardItem(definition.item.id, 1))}
                className={selected
                  ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                  : "rounded-xl border border-border bg-bg p-3 text-left hover:border-accentBorder"}
              >
                <div className="font-semibold text-textH">{definition.item.name}</div>
                <div className="mt-1 text-xs leading-5 text-textMuted">{definition.item.desc || "Sem descrição."}</div>
              </button>
            )
          })}
          {!definitions.length ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-textMuted sm:col-span-2">
              Nenhuma arma corresponde aos filtros atuais.
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  )
}

function isGenericWeapon(spec: StartingItemSpec): boolean {
  return spec.category === "weapon" && normalize(spec.name).includes("a escolha")
}

function isMartialPlaceholder(spec: StartingItemSpec): boolean {
  return normalize(spec.name).includes("marcial")
}

function formatSpec(spec: StartingItemSpec): string {
  const quantity = spec.quantity ?? 1
  return quantity > 1 ? `${spec.name} ×${quantity}` : spec.name
}

function ChoiceCard({
  selected,
  title,
  description,
  onClick,
}: {
  selected: boolean
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={selected
        ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
        : "rounded-xl border border-border bg-bg-subtle p-4 text-left hover:border-accentBorder"}
    >
      <span className="block text-sm font-semibold text-textH">{title}</span>
      <span className="mt-1 block text-xs leading-5 text-textMuted">{description}</span>
    </button>
  )
}

function mergeNotes(current: string | undefined, next: string): string {
  return Array.from(new Set([current?.trim(), next.trim()].filter(Boolean))).join(" ")
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export type { EquipmentOverride }
