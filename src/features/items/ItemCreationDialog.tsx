import { Select as SharedSelect } from "../../components/ui/Select"
import { Check, ClipboardCopy, FileJson, FormInput } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Textarea } from "../../components/ui/Textarea"
import { normalizeItemText } from "../../lib/textNormalization"
import {
  CURRENCY_DEFINITIONS,
  CURRENCY_TYPES,
  isCurrencyType,
  normalizeCurrencyItem,
  type CurrencyItem,
  type CurrencyType,
} from "../../models/items/Currency"
import { withShieldDefaults } from "../../models/items/equipment/Shield"
import type { ItemKind, Itemmable } from "../../models/items/item"
import {
  canItemGoInPocket,
  getDefaultPocketableForKind,
  isAutomaticallyPocketableKind,
} from "../../models/items/itemPocketability"
import { ConsumableFields, withConsumableDefaults } from "../characters/inventory/consumableFields"
import { EquipmentFields, withEquipmentDefaults } from "../characters/inventory/equipmentFields"
import { SupplyFields, withSupplyDefaults } from "../characters/inventory/supplyFields"
import { ThrowableFields, withThrowableDefaults } from "../characters/inventory/throwableFields"
import {
  itemJsonTemplate,
  parseItemJson,
  type ItemJsonAiTemplate,
} from "./itemJsonGuide"

const ITEM_KIND_OPTIONS: Array<{ value: ItemKind; label: string }> = [
  { value: "common", label: "Comum" },
  { value: "supply", label: "Suprimento" },
  { value: "equipment", label: "Equipamento" },
  { value: "shield", label: "Escudo" },
  { value: "ammunition", label: "Munição" },
  { value: "tool", label: "Ferramenta" },
  { value: "focus", label: "Foco" },
  { value: "instrument", label: "Instrumento" },
  { value: "pack", label: "Pacote" },
  { value: "gear", label: "Equipamento geral" },
  { value: "currency", label: "Moeda" },
  { value: "consumable", label: "Consumível" },
  { value: "throwable", label: "Arremessável" },
]

type EditorMode = "form" | "json"

type Props = {
  open: boolean
  title: string
  item?: Itemmable | null
  enableJson?: boolean
  jsonGuide?: ItemJsonAiTemplate | Record<string, unknown>
  saveLabel?: string
  onClose: () => void
  onSave: (item: Itemmable) => void
}

export function createItemDraft(): Itemmable {
  return {
    id: crypto.randomUUID(),
    name: "",
    desc: "",
    notes: "",
    quantity: 1,
    weight: 0,
    pocketable: false,
    kind: "common",
    magicItem: false,
    requiresAttunement: false,
    attuned: false,
    insideBagOfHolding: false,
  }
}

export function ItemCreationDialog({
  open,
  title,
  item,
  enableJson = false,
  jsonGuide,
  saveLabel = "Salvar item",
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<Itemmable | null>(null)
  const [mode, setMode] = useState<EditorMode>("form")
  const [jsonValue, setJsonValue] = useState("")
  const [jsonMessage, setJsonMessage] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setDraft(null)
      setMode("form")
      setJsonValue("")
      setJsonMessage("")
      setCopied(false)
      return
    }

    setDraft(item ?? createItemDraft())
    setMode("form")
    setJsonValue("")
    setJsonMessage("")
    setCopied(false)
  }, [item, open])

  if (!open || !draft) return null

  function patch(updater: (item: Itemmable) => Itemmable) {
    setDraft((current) => (current ? updater(current) : current))
  }

  function openJsonEditor() {
    setJsonValue((current) =>
      current.trim() ? current : JSON.stringify(draft, null, 2),
    )
    setJsonMessage("")
    setMode("json")
  }

  function applyJson() {
    try {
      const parsed = parseItemJson(jsonValue)
      setDraft(parsed)
      setJsonMessage("JSON carregado. Revise os campos antes de salvar.")
      setMode("form")
    } catch (error) {
      setJsonMessage(error instanceof Error ? error.message : "JSON inválido.")
    }
  }

  async function copyGuide() {
    try {
      const guide = JSON.stringify(jsonGuide ?? itemJsonTemplate(), null, 2)
      await navigator.clipboard.writeText(guide)
      setJsonValue(guide)
      setCopied(true)
      setJsonMessage("Guia completo copiado para a área de transferência.")
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setJsonMessage("Não foi possível copiar o guia JSON.")
    }
  }

  const automaticPocket = isAutomaticallyPocketableKind(draft.kind)
  const blockedFromPocket =
    draft.kind === "supply" ||
    draft.kind === "pack" ||
    draft.kind === "shield" ||
    draft.kind === "currency"

  return (
    <div
      className="fixed inset-0 z-[12000] flex max-w-[100vw] items-center justify-center overflow-x-hidden bg-black/65 p-2 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-creation-title"
    >
      <div className="grid max-h-[calc(100dvh-1rem)] w-full min-w-0 max-w-3xl gap-4 overflow-y-auto rounded-xl border border-border bg-bg-elevated p-3 shadow-theme-lg sm:p-4">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div>
            <h2
              id="item-creation-title"
              className="break-words text-sm font-semibold text-textH"
            >
              {title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Preencha os campos normalmente ou carregue um item pelo JSON.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        {enableJson ? (
          <div className="flex gap-2 border-b border-border pb-3">
            <Button
              size="sm"
              variant={mode === "form" ? "primary" : "secondary"}
              onClick={() => setMode("form")}
            >
              <FormInput className="h-4 w-4" />
              Formulário
            </Button>
            <Button
              size="sm"
              variant={mode === "json" ? "primary" : "secondary"}
              onClick={openJsonEditor}
            >
              <FileJson className="h-4 w-4" />
              JSON
            </Button>
          </div>
        ) : null}

        {mode === "json" && enableJson ? (
          <div className="grid gap-3">
            <div>
              <div className="text-xs font-medium text-textH">
                Importar item por JSON
              </div>
              <p className="mt-1 text-xs leading-5 text-textMuted">
                Cole um único item ou o guia completo preenchido. O conteúdo será
                carregado no formulário para revisão antes de salvar.
              </p>
            </div>

            <Textarea
              className="min-h-80 font-mono text-xs"
              value={jsonValue}
              placeholder="Cole o JSON do item"
              onChange={(event) => {
                setJsonValue(event.target.value)
                setJsonMessage("")
              }}
            />

            {jsonMessage ? (
              <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text">
                {jsonMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => void copyGuide()}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
                {copied ? "Copiado" : "Copiar guia para IA"}
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!jsonValue.trim()}
                onClick={applyJson}
              >
                Carregar no formulário
              </Button>
            </div>
          </div>
        ) : (
          <>
            {jsonMessage ? (
              <div className="rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text">
                {jsonMessage}
              </div>
            ) : null}

            <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_90px_110px]">
              <label className="grid min-w-0 gap-2">
                <span className="text-xs text-text">Item</span>
                <Input
                  value={draft.name}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Nome do item"
                />
              </label>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs text-text">Qtd.</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={draft.quantity}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      quantity: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </label>

              <label className="grid min-w-0 gap-2">
                <span className="text-xs text-text">Peso</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={draft.weight ?? 0}
                  disabled={draft.kind === "currency"}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      weight: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </label>

              <div className="grid min-w-0 gap-2 md:col-span-3">
                <span className="text-xs text-text">Tipo</span>
                <ItemKindButtons
                  value={draft.kind ?? "common"}
                  onChange={(kind) =>
                    patch((current) => updateItemKind(current, kind))
                  }
                />
              </div>

              {draft.kind === "currency" ? (
                <label className="grid min-w-0 gap-2 md:col-span-3">
                  <span className="text-xs text-text">Denominação</span>
                  <SharedSelect
                    className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
                    value={currencyTypeOf(draft)}
                    onChange={(event) =>
                      patch((current) =>
                        changeCurrencyType(
                          current,
                          event.target.value as CurrencyType,
                        ),
                      )
                    }
                  >
                    {CURRENCY_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {CURRENCY_DEFINITIONS[type].label} ({CURRENCY_DEFINITIONS[type].shortLabel})
                      </option>
                    ))}
                  </SharedSelect>
                </label>
              ) : null}

              <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text md:col-span-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.magicItem === true}
                  disabled={draft.kind === "currency"}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      magicItem: event.target.checked,
                      requiresAttunement: event.target.checked
                        ? current.requiresAttunement ?? false
                        : false,
                    }))
                  }
                />
                <span>
                  <span className="font-medium text-textH">Item mágico</span>
                  <span className="mt-0.5 block text-textMuted">
                    Permite filtrar o item como mágico e habilita a opção de exigir sintonia.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text md:col-span-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.requiresAttunement === true}
                  disabled={!draft.magicItem || draft.kind === "currency"}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      requiresAttunement: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="font-medium text-textH">Requer sintonia</span>
                  <span className="mt-0.5 block text-textMuted">
                    O item poderá ocupar um dos três espaços de sintonia do personagem.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-text md:col-span-3">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={canItemGoInPocket(draft)}
                  disabled={automaticPocket || blockedFromPocket}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      pocketable: event.target.checked,
                    }))
                  }
                />
                <span>
                  <span className="font-medium text-textH">Cabe no bolso</span>
                  <span className="mt-0.5 block text-textMuted">
                    {automaticPocket
                      ? "Esta categoria sempre pode ser guardada no bolso."
                      : blockedFromPocket
                        ? "Esta categoria não pode ser colocada no bolso."
                        : "Marque para permitir que este item seja colocado no bolso."}
                  </span>
                </span>
              </label>

              <label className="grid min-w-0 gap-2 md:col-span-3">
                <span className="text-xs text-text">Descrição</span>
                <Textarea
                  rows={2}
                  value={draft.desc ?? ""}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      desc: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="grid min-w-0 gap-2 md:col-span-3">
                <span className="text-xs text-text">Notas</span>
                <Textarea
                  rows={2}
                  value={draft.notes ?? ""}
                  onChange={(event) =>
                    patch((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>

              {draft.kind === "equipment" || draft.kind === "shield" ? (
                <EquipmentFields item={draft} onUpdate={patch} />
              ) : null}
              {draft.kind === "consumable" ? (
                <ConsumableFields item={draft} onUpdate={patch} />
              ) : null}
              {draft.kind === "throwable" ? (
                <ThrowableFields item={draft} onUpdate={patch} />
              ) : null}
              {draft.kind === "supply" ? (
                <SupplyFields item={draft} onUpdate={patch} />
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button size="sm" variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="primary"
                disabled={!draft.name.trim()}
                onClick={() => onSave(normalizeEditorItem(draft))}
              >
                {saveLabel}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function ItemKindButtons({
  value,
  onChange,
}: {
  value: ItemKind
  onChange: (value: ItemKind) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ITEM_KIND_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            value === option.value
              ? "rounded-md border border-accentBorder bg-accentBg px-2 py-2 text-xs font-medium text-textH"
              : "rounded-md border border-border px-2 py-2 text-xs text-text hover:bg-[color:var(--social-bg)]"
          }
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function updateItemKind(item: Itemmable, kind: ItemKind): Itemmable {
  if (kind === "equipment") {
    return withEquipmentDefaults(item, item.equipSlot ?? "weapon")
  }
  if (kind === "shield") return withShieldDefaults(item)
  if (kind === "consumable") return withConsumableDefaults(item)
  if (kind === "throwable") return withThrowableDefaults(item)
  if (kind === "supply") return withSupplyDefaults(item)
  if (kind === "currency") {
    return normalizeCurrencyItem({
      ...item,
      kind: "currency",
      currencyType: "gold",
      quantity: Math.max(1, Math.trunc(Number(item.quantity) || 1)),
    } as CurrencyItem)
  }

  return {
    ...item,
    kind,
    equippable: false,
    equipSlot: undefined,
    pocketable: getDefaultPocketableForKind(kind),
    insideBagOfHolding: false,
  }
}

function currencyTypeOf(item: Itemmable): CurrencyType {
  const value = (item as Partial<CurrencyItem>).currencyType
  return isCurrencyType(value) ? value : "gold"
}

function changeCurrencyType(
  item: Itemmable,
  currencyType: CurrencyType,
): Itemmable {
  return normalizeCurrencyItem({
    ...item,
    kind: "currency",
    currencyType,
  } as CurrencyItem)
}

function normalizeEditorItem(item: Itemmable): Itemmable {
  const normalized = normalizeItemText(item)
  return normalized.kind === "currency"
    ? normalizeCurrencyItem(normalized)
    : normalized
}
