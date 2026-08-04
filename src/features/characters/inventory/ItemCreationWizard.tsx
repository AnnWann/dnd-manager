import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import {
  STANDARD_ITEM_DEFINITIONS,
  findStandardItemDefinition,
  instantiateStandardItem,
} from "../../items/standardItemCompendium"
import type { Itemmable } from "../../../models/items/item"

const CUSTOM_TEMPLATE_ID = "custom-item"

type Props = {
  onCancel: () => void
  onCreate: (item: Itemmable) => void
}

export function ItemCreationWizard({ onCancel, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [query, setQuery] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [customName, setCustomName] = useState("")
  const [customDescription, setCustomDescription] = useState("")
  const [customNotes, setCustomNotes] = useState("")
  const [customWeight, setCustomWeight] = useState("0")
  const [customMagicItem, setCustomMagicItem] = useState(false)
  const [customAttunement, setCustomAttunement] = useState(false)

  const selectedDefinition = useMemo(
    () => findStandardItemDefinition(templateId),
    [templateId],
  )
  const isCustom = templateId === CUSTOM_TEMPLATE_ID
  const selectedItem = selectedDefinition?.item

  const filteredDefinitions = useMemo(() => {
    const normalized = normalizeSearch(query)
    if (!normalized) return STANDARD_ITEM_DEFINITIONS

    return STANDARD_ITEM_DEFINITIONS.filter(({ item, group }) =>
      normalizeSearch(
        [item.name, item.desc, item.kind, item.category, group]
          .filter(Boolean)
          .join(" "),
      ).includes(normalized),
    )
  }, [query])

  const canContinue =
    step === 1
      ? Boolean(templateId)
      : step === 2
        ? isCustom
          ? customName.trim().length > 0
          : true
        : true

  function createItem(): Itemmable {
    const normalizedQuantity = Math.max(
      1,
      Math.trunc(Number(quantity) || 1),
    )

    if (!isCustom) {
      return instantiateStandardItem(templateId, normalizedQuantity)
    }

    return {
      id: crypto.randomUUID(),
      name: customName.trim(),
      desc: customDescription.trim(),
      notes: customNotes.trim(),
      quantity: normalizedQuantity,
      weight: Math.max(0, Number(customWeight) || 0),
      pocketable: false,
      kind: "gear",
      magicItem: customMagicItem,
      requiresAttunement: customMagicItem && customAttunement,
      attuned: false,
      insideBagOfHolding: false,
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-textH">Adicionar item</h1>
          <p className="mt-1 text-sm text-textMuted">
            Etapa {step} de 3 · {step === 1 ? "Compêndio" : step === 2 ? "Configuração" : "Revisão"}
          </p>
        </div>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </header>

      {step === 1 ? (
        <div className="mt-4 grid gap-4">
          <Input
            value={query}
            placeholder="Buscar no compêndio por nome, tipo ou descrição"
            onChange={(event) => setQuery(event.target.value)}
          />

          <button
            type="button"
            className={
              templateId === CUSTOM_TEMPLATE_ID
                ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                : "rounded-xl border border-dashed border-border bg-bg-subtle p-4 text-left hover:bg-accentBg"
            }
            onClick={() => setTemplateId(CUSTOM_TEMPLATE_ID)}
          >
            <span className="block text-sm font-semibold text-textH">
              Criar item personalizado
            </span>
            <span className="mt-1 block text-xs leading-5 text-textMuted">
              Use apenas quando nenhum item padrão do compêndio representar o que você precisa.
            </span>
          </button>

          <div className="grid max-h-[36rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
            {filteredDefinitions.map(({ item, locked, group }) => (
              <button
                key={item.id}
                type="button"
                className={
                  templateId === item.id
                    ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                    : "rounded-xl border border-border bg-bg-subtle p-4 text-left hover:bg-accentBg"
                }
                onClick={() => setTemplateId(item.id)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-textH">
                    {item.name}
                  </span>
                  {locked ? <Badge label="Padrão fixo" /> : null}
                </div>
                <span className="mt-1 block text-[11px] uppercase tracking-wide text-textMuted">
                  {groupLabel(group)} · {item.weight} kg
                </span>
                <span className="mt-2 line-clamp-3 block text-xs leading-5 text-text">
                  {item.desc || "Sem descrição."}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 grid gap-4">
          {isCustom ? (
            <>
              <div className="rounded-lg border border-warning bg-warningBg p-3 text-xs leading-5 text-textH">
                Este item não usa uma definição oficial do compêndio. Os campos abaixo serão livres.
              </div>
              <label className="grid gap-1.5 text-xs text-text">
                Nome
                <Input value={customName} onChange={(event) => setCustomName(event.target.value)} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs text-text">
                  Quantidade
                  <Input type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
                </label>
                <label className="grid gap-1.5 text-xs text-text">
                  Peso por item (kg)
                  <Input type="number" min={0} step="any" value={customWeight} onChange={(event) => setCustomWeight(event.target.value)} />
                </label>
              </div>
              <label className="grid gap-1.5 text-xs text-text">
                Descrição
                <Textarea value={customDescription} onChange={(event) => setCustomDescription(event.target.value)} />
              </label>
              <label className="grid gap-1.5 text-xs text-text">
                Notas
                <Textarea value={customNotes} onChange={(event) => setCustomNotes(event.target.value)} />
              </label>
              <div className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-sm text-text">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={customMagicItem} onChange={(event) => setCustomMagicItem(event.target.checked)} />
                  Item mágico
                </label>
                {customMagicItem ? (
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={customAttunement} onChange={(event) => setCustomAttunement(event.target.checked)} />
                    Requer sintonia
                  </label>
                ) : null}
              </div>
            </>
          ) : selectedItem ? (
            <>
              <div className="rounded-xl border border-accentBorder bg-accentBg p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-textH">{selectedItem.name}</h2>
                  {selectedDefinition?.locked ? <Badge label="Definição protegida" /> : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-text">
                  {selectedItem.desc || "Sem descrição."}
                </p>
                <div className="mt-3 grid gap-1 text-xs text-textMuted sm:grid-cols-2">
                  <span>Tipo: {selectedItem.kind}</span>
                  <span>Peso: {selectedItem.weight} kg</span>
                  <span>Mágico: {selectedItem.magicItem ? "sim" : "não"}</span>
                  <span>Sintonia: {selectedItem.requiresAttunement ? "sim" : "não"}</span>
                </div>
              </div>

              <label className="grid max-w-xs gap-1.5 text-xs text-text">
                Quantidade
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  disabled={selectedItem.category === "bagOfHolding"}
                />
              </label>

              {selectedDefinition?.locked ? (
                <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-5 text-textMuted">
                  Nome, peso, categoria, propriedades mágicas e regras deste item vêm do compêndio e não podem ser alterados aqui.
                  {selectedItem.kind === "currency"
                    ? " Para moedas, apenas a quantidade é configurável."
                    : selectedItem.category === "bagOfHolding"
                      ? " A Bolsa Mágica é sempre criada como uma unidade canônica."
                      : ""}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-bg-subtle p-4 text-sm text-text">
          <div>
            <span className="text-textMuted">Item:</span>{" "}
            {isCustom ? customName.trim() : selectedItem?.name}
          </div>
          <div>
            <span className="text-textMuted">Quantidade:</span>{" "}
            {isCustom || selectedItem?.category !== "bagOfHolding"
              ? Math.max(1, Math.trunc(Number(quantity) || 1))
              : 1}
          </div>
          <div>
            <span className="text-textMuted">Origem:</span>{" "}
            {isCustom ? "Personalizado" : "Compêndio padrão"}
          </div>
          {!isCustom && selectedDefinition?.locked ? (
            <div className="rounded-lg border border-accentBorder bg-accentBg p-3 text-xs text-textH">
              Este item será criado a partir da definição canônica e manterá seus campos protegidos.
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
        <Button
          variant="secondary"
          onClick={() => {
            if (step === 1) onCancel()
            else setStep((step - 1) as 1 | 2)
          }}
        >
          {step === 1 ? "Cancelar" : "Voltar"}
        </Button>

        {step < 3 ? (
          <Button disabled={!canContinue} onClick={() => setStep((step + 1) as 2 | 3)}>
            Continuar
          </Button>
        ) : (
          <Button onClick={() => onCreate(createItem())}>Adicionar ao inventário</Button>
        )}
      </footer>
    </section>
  )
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}

function groupLabel(group: "currency" | "magic" | "equipment"): string {
  if (group === "currency") return "Moeda"
  if (group === "magic") return "Item mágico"
  return "Equipamento"
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {label}
    </span>
  )
}
