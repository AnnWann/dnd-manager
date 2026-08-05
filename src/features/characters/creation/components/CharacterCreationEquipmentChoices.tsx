import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../../components/ui/Button"
import { Input } from "../../../../components/ui/Input"
import {
  averageStartingGold,
  formatStartingGoldFormula,
  getDefaultClassEquipmentSelections,
  getPhbClassEquipmentPreset,
  getSelectedClassEquipment,
  rollStartingGold,
  type StartingItemSpec,
} from "../../../../data/characterCreation/phbClassEquipment"
import { createStartingInventoryItem } from "../../../../lib/characterCreation/startingEquipmentItems"
import { createCurrencyItem } from "../../../../models/items/Currency"
import type { Itemmable } from "../../../../models/items/item"
import { getClassNamePt } from "../../../../models/leveling/ClassLocalization"
import type { ClassName } from "../../../../models/sheet/Class"
import { ItemCreationDialog } from "../../../items/ItemCreationDialog"
import { normalizeStandardItem } from "../../../items/standardItemCompendium"
import {
  CharacterCreationWeaponPicker,
  type StartingWeaponCategory,
} from "./CharacterCreationWeaponPicker"

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

export function CharacterCreationEquipmentChoices({ onChange }: Props) {
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

      const heading = Array.from(
        document.querySelectorAll<HTMLElement>("h2"),
      ).find(
        (entry) =>
          entry.textContent?.trim().startsWith("Equipamento de nível 1 de") &&
          !entry.closest("[data-character-creation-equipment]"),
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
        anchor.dataset.characterCreationEquipmentAnchor !== "true"
      ) {
        anchor = document.createElement("div")
        anchor.dataset.characterCreationEquipmentAnchor = "true"
        source.parentElement?.insertBefore(anchor, source)
      }

      source.dataset.characterCreationEquipmentSource = "true"
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
        .querySelectorAll<HTMLElement>(
          "[data-character-creation-equipment-source]",
        )
        .forEach((source) => {
          source.style.display = ""
          delete source.dataset.characterCreationEquipmentSource
        })
      document
        .querySelectorAll<HTMLElement>(
          "[data-character-creation-equipment-anchor]",
        )
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
  const [genericWeapons, setGenericWeapons] = useState<
    Record<string, Itemmable>
  >({})
  const [gold, setGold] = useState(() =>
    averageStartingGold(preset.startingGold),
  )
  const [weaponPicker, setWeaponPicker] = useState<{
    key: string
    category: StartingWeaponCategory
  } | null>(null)
  const [customOpen, setCustomOpen] = useState(false)

  const selectedSpecs = useMemo(
    () => getSelectedClassEquipment(className, selections),
    [className, selections],
  )
  const unresolvedWeapons = useMemo(
    () =>
      selectedSpecs
        .filter(isGenericWeapon)
        .filter((spec) => !genericWeapons[spec.id]),
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
      data-character-creation-equipment="true"
      data-creation-step-valid={valid ? "true" : "false"}
      data-creation-step-error={override.error ?? ""}
      className="grid gap-5 rounded-xl border border-border bg-bg-subtle p-4"
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
          description={`${formatStartingGoldFormula(
            preset.startingGold,
          )} em vez do equipamento.`}
          onClick={() => setMode("gold")}
        />
      </div>

      {mode === "gold" ? (
        <section className="rounded-xl border border-accentBorder bg-accentBg p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="text-xs text-textMuted">
              Fórmula: {formatStartingGoldFormula(preset.startingGold)}. Média:{" "}
              {averageStartingGold(preset.startingGold)} PO.
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
                    setGold(
                      Math.max(
                        0,
                        Math.trunc(Number(event.target.value) || 0),
                      ),
                    )
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
              group.options.find(
                (option) => option.id === selections[group.id],
              ) ?? group.options[0]

            return (
              <section
                key={group.id}
                className="rounded-xl border border-border bg-bg p-4"
              >
                <div className="text-sm font-semibold text-textH">
                  {group.label}
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.options.map((option) => (
                    <ChoiceCard
                      key={option.id}
                      selected={selected?.id === option.id}
                      title={option.label}
                      description={option.items.map(formatSpec).join(" · ")}
                      onClick={() =>
                        setSelections((current) => ({
                          ...current,
                          [group.id]: option.id,
                        }))
                      }
                    />
                  ))}
                </div>

                {(selected?.items ?? [])
                  .filter(isGenericWeapon)
                  .map((spec) => (
                    <GenericWeaponChoice
                      key={spec.id}
                      spec={spec}
                      selected={genericWeapons[spec.id]}
                      onChoose={() =>
                        setWeaponPicker({
                          key: spec.id,
                          category: getWeaponCategory(spec),
                        })
                      }
                      onCreate={() => {
                        setWeaponPicker({
                          key: spec.id,
                          category: getWeaponCategory(spec),
                        })
                        setCustomOpen(true)
                      }}
                    />
                  ))}
              </section>
            )
          })}
        </div>
      )}

      {weaponPicker && !customOpen ? (
        <CharacterCreationWeaponPicker
          category={weaponPicker.category}
          current={genericWeapons[weaponPicker.key]}
          onClose={() => setWeaponPicker(null)}
          onSelect={(item) => {
            setGenericWeapons((current) => ({
              ...current,
              [weaponPicker.key]: item,
            }))
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
            setGenericWeapons((current) => ({
              ...current,
              [weaponPicker.key]: item,
            }))
          }
          setCustomOpen(false)
          setWeaponPicker(null)
        }}
      />
    </section>
  )
}

function GenericWeaponChoice({
  spec,
  selected,
  onChoose,
  onCreate,
}: {
  spec: StartingItemSpec
  selected?: Itemmable
  onChoose: () => void
  onCreate: () => void
}) {
  return (
    <div className="mt-3 rounded-lg border border-border bg-bg-subtle p-3">
      <div className="text-xs font-semibold text-textH">{spec.name}</div>
      <div className="mt-1 text-xs text-textMuted">
        {selected ? `Selecionada: ${selected.name}` : "Escolha uma arma."}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={onChoose}>
          Escolher arma
        </Button>
        <Button size="sm" variant="secondary" onClick={onCreate}>
          Criar arma personalizada
        </Button>
      </div>
    </div>
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

function getWeaponCategory(spec: StartingItemSpec): StartingWeaponCategory {
  return normalize(spec.name).includes("marcial") ? "martial" : "simple"
}

function formatSpec(spec: StartingItemSpec): string {
  const quantity = spec.quantity ?? 1
  return quantity > 1 ? `${spec.name} ×${quantity}` : spec.name
}

function mergeNotes(current: string | undefined, next: string): string {
  return Array.from(new Set([current?.trim(), next.trim()].filter(Boolean))).join(
    " ",
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
