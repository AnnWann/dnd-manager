import { useMemo, useState } from "react"
import { ArrowLeft, BookOpen, Check, ChevronRight, Folder, FolderOpen, Search, Users } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
import {
  creatureFolderChildren,
  creatureFolderLabel,
  creatureFolderParent,
  creatureFolderPaths,
  creatureFolderWithin,
  normalizeCreatureFolder,
} from "../../models/creatures/creatureFolders"

export type CreatureInitiativeSelection = { creature: CompendiumCreature; quantity: number }

type Props = {
  creatures: CompendiumCreature[]
  existingCreatureIds: string[]
  sharedInitiative: boolean
  onSharedInitiativeChange: (value: boolean) => void
  onConfirm: (creatures: CreatureInitiativeSelection[]) => void
  onClose: () => void
}

function matches(value: string, query: string): boolean {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .includes(query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR"))
}

export function CreatureCompendiumPicker({
  creatures,
  existingCreatureIds,
  sharedInitiative,
  onSharedInitiativeChange,
  onConfirm,
  onClose,
}: Props) {
  const [activeFolder, setActiveFolder] = useState("")
  const [query, setQuery] = useState("")
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const alreadyAdded = useMemo(() => new Set(existingCreatureIds), [existingCreatureIds])
  const folders = useMemo(() => creatureFolderPaths([], creatures), [creatures])
  const folderChildren = useMemo(
    () => query.trim()
      ? folders.filter(folder => matches(folder, query))
      : creatureFolderChildren(folders, activeFolder),
    [activeFolder, folders, query],
  )
  const visibleCreatures = useMemo(() =>
    creatures.filter(creature =>
      (query.trim()
        ? matches(`${creature.name} ${creature.basicName} ${creature.folder ?? ""}`, query)
        : normalizeCreatureFolder(creature.folder) === activeFolder)),
    [activeFolder, creatures, query],
  )
  const selectable = (creature: CompendiumCreature) => !creature.unique || !alreadyAdded.has(creature.id)
  const selected = creatures.filter(creature => (quantities[creature.id] ?? 0) > 0 && selectable(creature))
    .map(creature => ({ creature, quantity: creature.unique ? 1 : quantities[creature.id] }))
  const totalInitiatives = selected.reduce((sum, entry) =>
    sum + (entry.creature.unique ? Math.max(1, entry.creature.initiativeTurns) : entry.quantity), 0)

  function selectGroup(group: CompendiumCreature[], selected: boolean) {
    setQuantities(prev => {
      const next = { ...prev }
      for (const creature of group) {
        if (selectable(creature)) next[creature.id] = selected ? (prev[creature.id] || 1) : 0
      }
      return next
    })
  }

  const folderCreatures = creatures.filter(creature =>
    (query.trim()
      ? visibleCreatures.includes(creature)
      : activeFolder ? creatureFolderWithin(creature.folder, activeFolder) : true) &&
    selectable(creature),
  )
  const allFolderSelected = folderCreatures.length > 0 && folderCreatures.every(creature => (quantities[creature.id] ?? 0) > 0)

  return (
    <Modal title="Adicionar criaturas à iniciativa" description="Navegue pelas pastas, pesquise e escolha quantas criaturas entrarão no combate." onClose={onClose} className="max-w-4xl">
      <div className="grid gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-textMuted" />
          <Input autoFocus className="pl-9" placeholder="Pesquisar criaturas e pastas..." value={query} onChange={event => setQuery(event.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-textMuted">
            <button type="button" className="font-semibold hover:text-accent" onClick={() => { setActiveFolder(""); setQuery("") }}>
              <BookOpen className="mr-1 inline h-3.5 w-3.5" /> Compêndio
            </button>
            {activeFolder.split("/").filter(Boolean).map((part, index, parts) => (
              <span key={index} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button type="button" className="hover:text-accent" onClick={() => { setActiveFolder(parts.slice(0, index + 1).join("/")); setQuery("") }}>{part}</button>
              </span>
            ))}
          </div>
          <Button size="sm" variant="secondary" disabled={!folderCreatures.length}
            onClick={() => selectGroup(folderCreatures, !allFolderSelected)}>
            <Check className="h-3.5 w-3.5" />
            {allFolderSelected ? "Desmarcar grupo" : query.trim() ? "Selecionar resultados" : "Selecionar pasta inteira"}
          </Button>
        </div>
        {!query.trim() && activeFolder ? (
          <button className="flex items-center gap-2 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left text-xs text-textMuted hover:text-textH" type="button"
            onClick={() => setActiveFolder(creatureFolderParent(activeFolder))}>
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar uma pasta
          </button>
        ) : null}
        {folderChildren.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {folderChildren.map(folder => {
              const members = creatures.filter(creature => creatureFolderWithin(creature.folder, folder))
              return (
                <button type="button" key={folder} onClick={() => { setActiveFolder(folder); setQuery("") }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle px-3 py-3 text-left hover:border-accentBorder hover:bg-accentBg">
                  <Folder className="h-6 w-6 shrink-0 text-accent" />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-textH">{creatureFolderLabel(folder)}</span>
                    <span className="text-xs text-textMuted">{members.length} criatura{members.length === 1 ? "" : "s"} (incluindo subpastas)</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-textMuted" />
                </button>
              )
            })}
          </div>
        ) : null}
        <div className="grid max-h-[42vh] gap-2 overflow-y-auto pr-1">
          {visibleCreatures.map(creature => {
            const disabled = !selectable(creature)
            const checked = !disabled && (quantities[creature.id] ?? 0) > 0
            return (
              <div key={creature.id} className={`flex items-center gap-3 rounded-xl border p-3 ${checked ? "border-accentBorder bg-accentBg" : "border-border bg-bg"} ${disabled ? "opacity-60" : ""}`}>
                <input type="checkbox" aria-label={`Selecionar ${creature.name}`} disabled={disabled} checked={checked}
                  onChange={event => setQuantities(prev => ({ ...prev, [creature.id]: event.target.checked ? 1 : 0 }))} />
                {creature.sheetImageUrl ? (
                  <img src={creature.sheetImageUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover object-top" />
                ) : <FolderOpen className="h-8 w-8 shrink-0 text-textMuted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-textH">{creature.name}</div>
                  <div className="truncate text-xs text-textMuted">
                    {creature.basicName !== creature.name ? `${creature.basicName} · ` : ""}
                    {creature.unique ? `${creature.initiativeTurns} iniciativa(s)` : creature.category}
                    {disabled ? " · Já adicionada (única)" : ""}
                  </div>
                </div>
                {checked && !creature.unique ? (
                  <label className="grid gap-1 text-[10px] text-textMuted">Quantidade
                    <Input className="w-20" type="number" min={1} max={50}
                      value={quantities[creature.id]} onChange={event => setQuantities(prev => ({
                        ...prev, [creature.id]: Math.min(50, Math.max(1, Math.trunc(Number(event.target.value) || 1))),
                      }))} />
                  </label>
                ) : null}
              </div>
            )
          })}
          {!visibleCreatures.length && !folderChildren.length ? (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-textMuted">
              Nenhuma criatura nesta pasta ou busca.
            </div>
          ) : null}
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg-elevated pt-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-textH"><Users className="mr-1 inline h-4 w-4" /> {selected.length} ficha(s), {totalInitiatives} entrada(s)</span>
            <label className="flex items-center gap-2 text-xs text-textMuted">
              <input type="checkbox" checked={sharedInitiative} onChange={event => onSharedInitiativeChange(event.target.checked)} />
              Iniciativa conjunta entre cópias da mesma criatura
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" disabled={selected.length === 0} onClick={() => { onConfirm(selected); onClose() }}>
              Adicionar {totalInitiatives} à iniciativa
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
