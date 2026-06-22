import { useEffect, useMemo, useRef, useState } from "react"
import { Check, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Player } from "../../../models/player/Player"
import type { ClassName } from "../../../models/sheet/Class"
import { CharacterCreationWizard as BaseCharacterCreationWizard } from "./characterCreationWizardV2"
import {
  averageStartingGold,
  formatStartingGoldFormula,
  getDefaultClassEquipmentSelections,
  getPhbClassEquipmentPreset,
  getSelectedClassEquipment,
  rollStartingGold,
  type StartingItemCategory,
} from "./phbClassEquipment"
import {
  createStartingGoldItem,
  createStartingInventoryItem,
} from "./startingEquipmentItems"
import { PHB_CLASS_PRESETS } from "./phbPresets"

type Props = {
  open: boolean
  defaultOwner: Player
  owners: Player[]
  canAssignOwners: boolean
  onClose: () => void
  onCreate: (character: CharacterTemplate) => void
  createOwner: (ownerName: string) => Player
}

type EquipmentMode = "equipment" | "gold"

const CATEGORY_LABELS: Record<StartingItemCategory, string> = {
  weapon: "Arma",
  armor: "Armadura",
  shield: "Escudo",
  ammunition: "Munição",
  tool: "Ferramenta",
  focus: "Foco",
  instrument: "Instrumento",
  pack: "Pacote",
  gear: "Equipamento",
  currency: "Moeda",
}

export function CharacterCreationWizard({
  open,
  defaultOwner,
  owners,
  canAssignOwners,
  onClose,
  onCreate,
  createOwner,
}: Props) {
  const advancingRef = useRef(false)
  const [pendingCharacter, setPendingCharacter] =
    useState<CharacterTemplate | null>(null)
  const [mode, setMode] = useState<EquipmentMode>("equipment")
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [flavors, setFlavors] = useState<Record<string, string>>({})
  const [startingGold, setStartingGold] = useState(0)

  const className: ClassName | undefined = pendingCharacter
    ?.get("sheet")
    .classes?.[0]?.className
  const preset = className
    ? getPhbClassEquipmentPreset(className)
    : undefined
  const selectedItems = useMemo(
    () =>
      className
        ? getSelectedClassEquipment(className, selections)
        : [],
    [className, selections],
  )
  const classLabel =
    PHB_CLASS_PRESETS.find((entry) => entry.id === className)?.name ??
    className ??
    "Classe"

  useEffect(() => {
    if (open) return
    setPendingCharacter(null)
    setSelections({})
    setFlavors({})
  }, [open])

  useEffect(() => {
    if (!className || !preset) return
    setMode("equipment")
    setSelections(getDefaultClassEquipmentSelections(className))
    setStartingGold(averageStartingGold(preset.startingGold))
    setFlavors({})
  }, [className, preset])

  function interceptCreate(character: CharacterTemplate) {
    advancingRef.current = true
    setPendingCharacter(character)
  }

  function handleBaseClose() {
    if (advancingRef.current) {
      advancingRef.current = false
      return
    }
    onClose()
  }

  function finish() {
    if (!pendingCharacter) return

    const retainedInventory = pendingCharacter
      .get("inventory")
      .filter(
        (item) =>
          !item.desc
            .toLocaleLowerCase("pt-BR")
            .includes("equipamento inicial da classe"),
      )

    const classInventory =
      mode === "gold"
        ? startingGold > 0
          ? [createStartingGoldItem(startingGold)]
          : []
        : selectedItems.map((item, index) =>
            createStartingInventoryItem(
              item,
              flavors[`${item.id}:${index}`],
            ),
          )

    onCreate(
      pendingCharacter.with("inventory", [
        ...retainedInventory,
        ...classInventory,
      ]),
    )
    setPendingCharacter(null)
    onClose()
  }

  return (
    <>
      <BaseCharacterCreationWizard
        open={open && pendingCharacter === null}
        defaultOwner={defaultOwner}
        owners={owners}
        canAssignOwners={canAssignOwners}
        createOwner={createOwner}
        onClose={handleBaseClose}
        onCreate={interceptCreate}
      />

      {open && pendingCharacter && preset ? (
        <div
          className="fixed inset-0 z-[90] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/70 p-0 backdrop-blur-sm sm:p-4"
          onMouseDown={onClose}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="starting-equipment-title"
            className="grid h-[100dvh] w-full min-w-0 max-w-[100vw] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-bg-elevated text-text shadow-theme-lg sm:h-auto sm:max-h-[94dvh] sm:max-w-4xl sm:rounded-xl sm:border sm:border-border"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="flex min-w-0 items-start justify-between gap-3 border-b border-border p-3 sm:p-4">
              <div className="min-w-0">
                <h2
                  id="starting-equipment-title"
                  className="break-words text-base font-semibold text-textH"
                >
                  Equipamento inicial — {classLabel}
                </h2>
                <p className="mt-1 break-words text-xs leading-5 text-textMuted">
                  Escolha as opções da classe ou use o ouro inicial. O nome de
                  cada item pode ser alterado sem mudar sua base mecânica.
                </p>
              </div>
              <button
                type="button"
                aria-label="Cancelar criação"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <main className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-5">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg p-2">
                <ModeButton
                  active={mode === "equipment"}
                  onClick={() => setMode("equipment")}
                >
                  Pacote de classe
                </ModeButton>
                <ModeButton
                  active={mode === "gold"}
                  onClick={() => setMode("gold")}
                >
                  Ouro inicial
                </ModeButton>
              </div>

              {mode === "equipment" ? (
                <div className="mt-4 grid min-w-0 gap-4">
                  {preset.choiceGroups.map((choiceGroup) => (
                    <section
                      key={choiceGroup.id}
                      className="min-w-0 rounded-xl border border-border bg-bg p-3"
                    >
                      <div className="text-xs font-semibold text-textH">
                        {choiceGroup.label}
                      </div>
                      <div className="mt-2 flex max-w-full gap-2 overflow-x-auto pb-1">
                        {choiceGroup.options.map((choiceOption) => {
                          const selected =
                            selections[choiceGroup.id] === choiceOption.id
                          return (
                            <button
                              key={choiceOption.id}
                              type="button"
                              onClick={() =>
                                setSelections((current) => ({
                                  ...current,
                                  [choiceGroup.id]: choiceOption.id,
                                }))
                              }
                              className={
                                selected
                                  ? "shrink-0 rounded-full border border-accentBorder bg-accentBg px-3 py-2 text-[11px] font-semibold text-textH"
                                  : "shrink-0 rounded-full border border-border bg-bg-subtle px-3 py-2 text-[11px] text-text"
                              }
                            >
                              {selected ? "✓ " : ""}
                              {choiceOption.label}
                            </button>
                          )
                        })}
                      </div>
                    </section>
                  ))}

                  <section className="min-w-0 rounded-xl border border-border bg-bg p-3">
                    <div className="text-xs font-semibold text-textH">
                      Nome e aparência
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-textMuted">
                      Renomear altera apenas a apresentação. Armas continuam
                      armas, armaduras continuam armaduras e os valores
                      mecânicos são preservados.
                    </p>
                    <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                      {selectedItems.map((selectedItem, index) => {
                        const flavorKey = `${selectedItem.id}:${index}`
                        return (
                          <label
                            key={flavorKey}
                            className="grid min-w-0 gap-1.5 rounded-lg border border-border bg-bg-subtle p-3"
                          >
                            <span className="flex min-w-0 items-center justify-between gap-2 text-[10px] text-textMuted">
                              <span className="truncate">
                                {selectedItem.name}
                                {(selectedItem.quantity ?? 1) > 1
                                  ? ` ×${selectedItem.quantity}`
                                  : ""}
                              </span>
                              <span className="shrink-0 uppercase">
                                {CATEGORY_LABELS[selectedItem.category]}
                              </span>
                            </span>
                            <Input
                              value={flavors[flavorKey] ?? selectedItem.name}
                              onChange={(event) =>
                                setFlavors((current) => ({
                                  ...current,
                                  [flavorKey]: event.target.value,
                                }))
                              }
                            />
                          </label>
                        )
                      })}
                    </div>
                  </section>
                </div>
              ) : (
                <section className="mt-4 grid min-w-0 gap-4 rounded-xl border border-border bg-bg p-4">
                  <div>
                    <div className="text-sm font-semibold text-textH">
                      Ouro inicial da classe
                    </div>
                    <p className="mt-1 text-xs leading-5 text-textMuted">
                      Fórmula: {formatStartingGoldFormula(preset.startingGold)}.
                      Substitui o pacote da classe e preserva os itens do
                      antecedente.
                    </p>
                  </div>
                  <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <label className="grid min-w-0 gap-1.5">
                      <span className="text-xs font-medium text-textH">
                        Peças de ouro
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={startingGold}
                        onChange={(event) =>
                          setStartingGold(
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
                      onClick={() =>
                        setStartingGold(rollStartingGold(preset.startingGold))
                      }
                    >
                      Rolar ouro
                    </Button>
                  </div>
                </section>
              )}
            </main>

            <footer className="flex min-w-0 flex-col-reverse gap-2 border-t border-border bg-bg-elevated p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
              <Button
                variant="secondary"
                onClick={() => setPendingCharacter(null)}
              >
                Voltar
              </Button>
              <div className="flex min-w-0 flex-col-reverse gap-2 sm:flex-row">
                <Button variant="secondary" onClick={onClose}>
                  Cancelar
                </Button>
                <Button variant="primary" onClick={finish}>
                  <Check className="h-4 w-4" />
                  Criar com {mode === "equipment" ? "equipamento" : "ouro"}
                </Button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "min-w-0 rounded-lg border border-accentBorder bg-accentBg px-3 py-3 text-xs font-semibold text-textH"
          : "min-w-0 rounded-lg border border-transparent px-3 py-3 text-xs text-textMuted"
      }
    >
      {children}
    </button>
  )
}
