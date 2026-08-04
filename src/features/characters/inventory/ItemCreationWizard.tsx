import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Textarea } from "../../../components/ui/Textarea"
import type {
  ItemCategory,
  ItemKind,
  Itemmable,
} from "../../../models/items/item"

export type ItemCreationCategory =
  | "common"
  | "equipment"
  | "consumable"
  | "throwable"
  | "supply"
  | "ammunition"
  | "tool"
  | "focus"
  | "instrument"
  | "pack"
  | "gear"
  | "currency"
  | "shield"
  | "bagOfHolding"

const CATEGORIES: Array<{
  value: ItemCreationCategory
  label: string
  description: string
}> = [
  { value: "common", label: "Comum", description: "Objetos sem regras especiais." },
  { value: "equipment", label: "Equipamento", description: "Armas, armaduras e equipamentos vestíveis." },
  { value: "shield", label: "Escudo", description: "Escudos e defesas equipáveis." },
  { value: "consumable", label: "Consumível", description: "Poções e itens consumidos ao usar." },
  { value: "throwable", label: "Arremessável", description: "Itens usados em ataques arremessados." },
  { value: "supply", label: "Suprimento", description: "Comida, água e outros suprimentos." },
  { value: "ammunition", label: "Munição", description: "Flechas, virotes e munições semelhantes." },
  { value: "tool", label: "Ferramenta", description: "Ferramentas e kits de ofício." },
  { value: "focus", label: "Foco", description: "Focos arcanos, divinos ou druídicos." },
  { value: "instrument", label: "Instrumento", description: "Instrumentos musicais." },
  { value: "pack", label: "Pacote", description: "Pacotes e conjuntos de itens." },
  { value: "gear", label: "Equipamento geral", description: "Equipamentos de exploração e aventura." },
  { value: "currency", label: "Moeda", description: "Dinheiro e valores monetários." },
  {
    value: "bagOfHolding",
    label: "Bolsa Mágica",
    description: "Habilita capacidade extradimensional e controles de armazenamento.",
  },
]

type Props = {
  onCancel: () => void
  onCreate: (item: Itemmable) => void
}

export function ItemCreationWizard({ onCancel, onCreate }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [category, setCategory] = useState<ItemCreationCategory>("common")
  const [name, setName] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [weight, setWeight] = useState("0")
  const [description, setDescription] = useState("")
  const [notes, setNotes] = useState("")
  const [magicItem, setMagicItem] = useState(false)
  const [requiresAttunement, setRequiresAttunement] = useState(false)

  const selectedCategory = useMemo(
    () => CATEGORIES.find((entry) => entry.value === category)!,
    [category],
  )

  const normalizedName = name.trim()
  const canContinue = step !== 2 || normalizedName.length > 0

  function finish() {
    const kind: ItemKind = category === "bagOfHolding" ? "gear" : category
    const itemCategory: ItemCategory | undefined =
      category === "bagOfHolding" ? "bagOfHolding" : undefined

    onCreate({
      id: crypto.randomUUID(),
      name: normalizedName,
      desc: description.trim(),
      notes: notes.trim(),
      quantity: Math.max(1, Math.trunc(Number(quantity) || 1)),
      weight: Math.max(0, Number(weight) || 0),
      pocketable: false,
      kind,
      category: itemCategory,
      magicItem: category === "bagOfHolding" ? true : magicItem,
      requiresAttunement:
        category === "bagOfHolding" ? false : magicItem && requiresAttunement,
      attuned: false,
      insideBagOfHolding: false,
    })
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-textH">Criar item</h1>
          <p className="mt-1 text-sm text-textMuted">
            Etapa {step} de 3 · {step === 1 ? "Categoria" : step === 2 ? "Detalhes" : "Revisão"}
          </p>
        </div>
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      </header>

      {step === 1 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              className={
                category === entry.value
                  ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                  : "rounded-xl border border-border bg-bg-subtle p-4 text-left hover:bg-accentBg"
              }
              onClick={() => setCategory(entry.value)}
            >
              <span className="block text-sm font-semibold text-textH">{entry.label}</span>
              <span className="mt-1 block text-xs leading-5 text-textMuted">{entry.description}</span>
            </button>
          ))}
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 grid gap-4">
          <div className="rounded-lg border border-accentBorder bg-accentBg p-3 text-sm text-textH">
            Categoria: <strong>{selectedCategory.label}</strong>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_110px_130px]">
            <label className="grid gap-1.5 text-xs text-text">
              Nome
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs text-text">
              Quantidade
              <Input type="number" min={1} step={1} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-xs text-text">
              Peso por item (kg)
              <Input type="number" min={0} step="any" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </label>
          </div>

          <label className="grid gap-1.5 text-xs text-text">
            Descrição
            <Textarea value={description} onChange={(event) => setDescription(event.target.value)} />
          </label>

          <label className="grid gap-1.5 text-xs text-text">
            Notas
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>

          {category !== "bagOfHolding" ? (
            <div className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-3 text-sm text-text">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={magicItem} onChange={(event) => setMagicItem(event.target.checked)} />
                Item mágico
              </label>
              {magicItem ? (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={requiresAttunement} onChange={(event) => setRequiresAttunement(event.target.checked)} />
                  Requer sintonia
                </label>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-bg-subtle p-3 text-xs leading-5 text-textMuted">
              A Bolsa Mágica é sempre tratada como item mágico e não pode ser colocada dentro de si mesma.
            </div>
          )}
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 grid gap-3 rounded-xl border border-border bg-bg-subtle p-4 text-sm text-text">
          <div><span className="text-textMuted">Categoria:</span> {selectedCategory.label}</div>
          <div><span className="text-textMuted">Nome:</span> {normalizedName}</div>
          <div><span className="text-textMuted">Quantidade:</span> {Math.max(1, Math.trunc(Number(quantity) || 1))}</div>
          <div><span className="text-textMuted">Peso:</span> {Math.max(0, Number(weight) || 0)} kg por item</div>
          <div><span className="text-textMuted">Item mágico:</span> {category === "bagOfHolding" || magicItem ? "Sim" : "Não"}</div>
          {description.trim() ? <div className="whitespace-pre-wrap"><span className="text-textMuted">Descrição:</span> {description.trim()}</div> : null}
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
          <Button onClick={finish}>Criar item</Button>
        )}
      </footer>
    </section>
  )
}
