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

type EquipmentTarget = {
  anchor: HTMLElement
  source: HTMLElement
  className: ClassName
}

export type EquipmentOverride = {
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

const CLASS_NAMES = [
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
] as const satisfies readonly ClassName[]

const CLASS_BY_LABEL = new Map(
  CLASS_NAMES.map((className) => [getClassNamePt(className), className]),
)

export function CharacterCreationEquipmentChoicesStableV2({ onChange }: Props) {
  const [target, setTarget] = useState<EquipmentTarget | null>(null)
  const targetRef = useRef<EquipmentTarget | null>(null)

  useEffect(() => {
    targetRef.current = target
  }, [target])

  useEffect(() => {
    let disposed = false

    const findTarget = () => {
      if (disposed) return
      const current = targetRef.current
      if (current?.anchor.isConnected && current.source.isConnected) return

      const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find(
        (entry) =>
          entry.textContent?.trim().startsWith("Equipamento de nível 1 de") &&
          !entry.closest("[data-stable-class-equipment-v2]") &&
          !entry.closest("[data-class-equipment-configurator]"),
      )

      if (!heading) {
        if (current) {
          targetRef.current = null
          setTarget(null)
        }
        return
      }

      const source = heading.closest<HTMLElement>("section")
      if (!source) return
      const label = heading.textContent
        ?.replace("Equipamento de nível 1 de", "")
        .trim()
      const className = label ? CLASS_BY_LABEL.get(label) : undefined
      if (!className) return

      let anchor = source.previousElementSibling
      if (
        !(anchor instanceof HTMLElement) ||
        anchor.dataset.stableClassEquipmentAnchorV2 !== "true"
      ) {
        anchor = document.createElement("div")
        anchor.dataset.stableClassEquipmentAnchorV2 = "true"
        source.parentElement?.insertBefore(anchor, source)
      }

      source.dataset.stableClassEquipmentSourceV2 = "true"
      source.style.display = "none"
      const next = { anchor, source, className }
      targetRef.current = next
      setTarget(next)
    }

    findTarget()
    const interval = window.setInterval(findTarget, 300)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document
        .querySelectorAll<HTMLElement>("[data-stable-class-equipment-source-v2]")
        .forEach((source) => {
          source.style.display = ""
          delete source.dataset.stableClassEquipmentSourceV2
        })
      document
        .querySelectorAll<HTMLElement>("[data-stable-class-equipment-anchor-v2]")
        .forEach((anchor) => anchor.remove())
    }
  }, [])

  useEffect(() => {
    if (!target) onChange(null)
  }, [onChange, target])

  if (!target) return null

  return createPortal(
    <ClassEquipmentConfigurator
      key={target.className}
      className={target.className}
      onChange={onChange}
    />,
    target.anchor,
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
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    getDefaultClassEquipmentSelections(className),
  )
  const [genericWeapons, setGenericWeapons] = useState<Record<string, Itemmable>>({})
  const [gold, setGold] = useState(() => averageStartingGold(preset.startingGold))
  const [weaponPicker, setWeaponPicker] = useState<{
    key: string
    category: "simple" | "martial"
  } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

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
      const selectedWeapon = genericWeapons[spec.id]
      const item = selectedWeapon ?? createStartingInventoryItem(spec)
      return normalizeStandardItem({
        ...item,
        id: selectedWeapon?.id ?? `starting-${className}-${spec.id}`,
        notes: mergeNotes(
          item.notes,
          `Equipamento inicial da classe ${getClassNamePt(className)}.`,
        ),
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
    onChange(override)
  }, [onChange, override])

  return (
    <section
      data-stable-class-equipment-v2="true"
      className={`grid gap-5 rounded-xl border p-4 ${
        valid
          ? "border-border bg-bg-subtle"
          : "border-danger bg-dangerBg/20"
      }`}
    >
      <header>
        <h2 className="font-semibold text-textH">
          Equipamento de nível 1 de {getClassNamePt(className)}
        </h2>
        <p className="mt-1 text-xs text-textMuted">
          Escolha uma opção de cada grupo ou use o ouro inicial.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          selected={mode === "equipment"}
          title="Equipamento inicial"
          description="Escolha uma opção de cada grupo e resolva as armas genéricas."
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
            <div className="text-xs text-textMuted">
              Fórmula: {formatStartingGoldFormula(preset.startingGold)}. Média: {averageStartingGold(preset.startingGold)} PO.
            </div>
            <div className="flex items-end gap-2">
              <label className="grid gap-1 text-xs text-textMuted">
                Peças de ouro
                <Input
                  className="w-28"
                  type="number"
                  min={0}
                  value={gold}
                  onChange={(event) =>
                    setGold(Math.max(0, Math.trunc(Number(event.target.value) || 0)))
                  }
                />
              </label>
              <Button
                variant="secondary"
                onClick={() => setGold(rollStartingGold(preset.startingGold))}
              >
                Rolar
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <div className="grid gap-4">
          {preset.choiceGroups.map((group) => {
            const selected =
              group.options.find((option) => option.id === selections[group.id]) ??
              group.options[0]
            return (
              <section key={group.id} className="rounded-xl border border-border bg-bg p-4">
                <div className="text-sm font-semibold text-textH">{group.label}</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.options.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      selected={selected?.id === option.id}
                      title={option.label}
                      description={option.items.map(formatSpec).join(" · ")}
                      onClick={() =>
                        setSelections((current) => ({ ...current, [group.id]: option.id }))
                      }
                    />
                  ))}
                </div>

                {(selected?.items ?? []).filter(isGenericWeapon).map((spec) => {
                  const chosen = genericWeapons[spec.id]
                  const category = isMartialPlaceholder(spec) ? "martial" : "simple"
                  return (
                    <div
                      key={spec.id}
                      className={`mt-3 rounded-lg border p-3 ${
                        chosen
                          ? "border-border bg-bg-subtle"
                          : "border-danger bg-dangerBg"
                      }`}
                    >
                      <div className="text-xs font-semibold text-textH">{spec.name}</div>
                      <div className={chosen ? "mt-1 text-xs text-textMuted" : "mt-1 text-xs text-danger"}>
                        {chosen ? `Selecionada: ${chosen.name}` : "Campo obrigatório: escolha uma arma."}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
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
    const normalizedQuery = normalize(query)
    return STANDARD_ITEM_DEFINITIONS.filter((definition) => {
      const item = definition.item
      if (!(item.kind === "equipment" && item.equipSlot === "weapon")) return false
      if (!matchesPhbWeaponCategory(item, category)) return false
      return (
        !normalizedQuery ||
        normalize(`${item.name} ${item.desc ?? ""}`).includes(normalizedQuery)
      )
    })
  }, [category, query])

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/75 p-4" onMouseDown={onClose}>
      <section className="grid max-h-[90dvh] w-full max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden rounded-2xl border border-border bg-bg-elevated" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold text-textH">
            Escolher arma {category === "martial" ? "marcial" : "simples"}
          </h2>
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
                className={
                  selected
                    ? "rounded-xl border border-accentBorder bg-accentBg p-3 text-left"
                    : "rounded-xl border border-border bg-bg p-3 text-left"
                }
              >
                <div className="font-semibold text-textH">{definition.item.name}</div>
                <div className="mt-1 text-xs text-textMuted">{definition.item.desc || "Sem descrição."}</div>
              </button>
            )
          })}
        </div>
      </section>
    </div>,
    document.body,
  )
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
      className={
        selected
          ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
          : "rounded-xl border border-border bg-bg-subtle p-4 text-left"
      }
    >
      <span className="block text-sm font-semibold text-textH">{title}</span>
      <span className="mt-1 block text-xs text-textMuted">{description}</span>
    </button>
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
