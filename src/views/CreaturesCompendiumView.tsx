import { Select as SharedSelect } from "../components/ui/Select"
import {
  Archive,
  BookOpen,
  Copy,
  FileImage,
  FileJson,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Modal } from "../components/ui/Modal"
import { useCreatureCompendium } from "../contexts/creatureCompendiumContext"
import { useSyncContext } from "../contexts/syncContext"
import { CreatureCompendiumTransferBar } from "../features/creatures/CreatureCompendiumTransferBar"
import { CreatureEditorDialog } from "../features/creatures/CreatureEditorDialog"
import {
  CreatureQuickSheet,
  quickSheetFromCompendiumCreature,
} from "../features/creatures/CreatureQuickSheet"
import {
  downloadCreatureJson,
  downloadCreatureZip,
} from "../features/creatures/creatureCompendiumIO"
import {
  createCompendiumCreature,
  creatureFeatureSearchText,
  type CompendiumCreature,
  type CreatureSide,
} from "../models/creatures/CompendiumCreature"

export function CreaturesCompendiumView() {
  const { campaignCapabilities } = useSyncContext()
  const {
    creatures,
    hydrated,
    upsertCreature,
    upsertCreatures,
    deleteCreature,
    duplicateCreature,
  } = useCreatureCompendium()
  const [query, setQuery] = useState("")
  const [sideFilter, setSideFilter] = useState<CreatureSide | "all">("all")
  const [editingCreature, setEditingCreature] =
    useState<CompendiumCreature>()
  const [viewingCreature, setViewingCreature] =
    useState<CompendiumCreature>()

  const filteredCreatures = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)

    return creatures.filter((creature) => {
      const featureText = creatureFeatureSearchText([
        ...creature.traits,
        ...creature.actions,
        ...creature.bonusActions,
        ...creature.reactions,
        ...creature.legendaryActions,
      ])
      const searchableText = normalizeSearchText(
        `${creature.name} ${creature.category} ${featureText}`,
      )
      const matchesQuery =
        !normalizedQuery || searchableText.includes(normalizedQuery)
      const matchesSide =
        sideFilter === "all" || creature.defaultSide === sideFilter

      return matchesQuery && matchesSide
    })
  }, [creatures, query, sideFilter])

  if (!campaignCapabilities.includes("creation.creatures.manage")) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-bg p-6">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-accent" />
          <div>
            <h1 className="font-heading text-lg font-semibold text-textH">
              Compêndio de Criaturas
            </h1>
            <p className="mt-1 text-sm text-text">
              Sua função nesta sessão não possui acesso ao compêndio de criaturas.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!hydrated) {
    return (
      <div className="rounded-xl border border-border bg-bg p-6 text-sm text-text">
        Carregando compêndio local…
      </div>
    )
  }

  async function exportCreatureZip(creature: CompendiumCreature) {
    try {
      const warnings = await downloadCreatureZip(creature)
      if (warnings.length > 0) window.alert(warnings.join("\n"))
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Não foi possível exportar a criatura.",
      )
    }
  }

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BookOpen className="h-6 w-6 text-accent" />
              <h1 className="font-heading text-xl font-semibold text-textH">
                Compêndio de Criaturas
              </h1>
              <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-xs text-textMuted">
                {creatures.length} criatura{creatures.length === 1 ? "" : "s"}
              </span>
              <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-xs text-textMuted">
                Dados locais
              </span>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text">
              Fichas enxutas para a Criação: estatísticas de combate, habilidades,
              ações, notas e uma imagem opcional da ficha original.
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => setEditingCreature(createCompendiumCreature())}
          >
            <Plus className="h-4 w-4" />
            Nova criatura
          </Button>
        </div>
      </section>

      <CreatureCompendiumTransferBar
        creatures={creatures}
        onImport={upsertCreatures}
      />

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, categoria ou habilidade…"
            />
          </label>

          <SharedSelect
            className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            value={sideFilter}
            onChange={(event) =>
              setSideFilter(event.target.value as CreatureSide | "all")
            }
          >
            <option value="all">Todos os lados</option>
            <option value="enemy">Inimigos</option>
            <option value="ally">Aliados</option>
            <option value="neutral">Neutros</option>
          </SharedSelect>
        </div>
      </section>

      {filteredCreatures.length > 0 ? (
        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filteredCreatures.map((creature) => (
            <CreatureCard
              key={creature.id}
              creature={creature}
              onView={() => setViewingCreature(creature)}
              onEdit={() => setEditingCreature(creature)}
              onDuplicate={() => {
                const duplicate = duplicateCreature(creature.id)
                if (duplicate) setEditingCreature(duplicate)
              }}
              onExportJson={() => downloadCreatureJson(creature)}
              onExportZip={() => void exportCreatureZip(creature)}
              onDelete={() => {
                if (
                  window.confirm(
                    `Remover ${creature.name} do compêndio local?`,
                  )
                ) {
                  deleteCreature(creature.id)
                }
              }}
            />
          ))}
        </section>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-bg p-10 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-textMuted" />
          <h2 className="mt-3 text-sm font-semibold text-textH">
            {creatures.length === 0
              ? "O compêndio está vazio"
              : "Nenhuma criatura encontrada"}
          </h2>
          <p className="mt-1 text-sm text-text">
            {creatures.length === 0
              ? "Crie fichas rápidas ou importe arquivos JSON e ZIP."
              : "Tente alterar a busca ou o filtro de lado."}
          </p>
        </section>
      )}

      {editingCreature ? (
        <CreatureEditorDialog
          creature={editingCreature}
          onClose={() => setEditingCreature(undefined)}
          onSave={(creature) => {
            upsertCreature(creature)
            setEditingCreature(undefined)
          }}
        />
      ) : null}

      {viewingCreature ? (
        <Modal
          title={`Ficha rápida — ${viewingCreature.name}`}
          onClose={() => setViewingCreature(undefined)}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={quickSheetFromCompendiumCreature(viewingCreature)}
            preferImage={Boolean(viewingCreature.sheetImageUrl)}
          />
        </Modal>
      ) : null}
    </div>
  )
}

function CreatureCard({
  creature,
  onView,
  onEdit,
  onDuplicate,
  onExportJson,
  onExportZip,
  onDelete,
}: {
  creature: CompendiumCreature
  onView: () => void
  onEdit: () => void
  onDuplicate: () => void
  onExportJson: () => void
  onExportZip: () => void
  onDelete: () => void
}) {
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-bg shadow-theme-sm transition-colors hover:border-borderStrong">
      <button
        type="button"
        className="grid min-w-0 flex-1 gap-4 p-4 text-left"
        onClick={onView}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-bg-subtle">
            {creature.sheetImageUrl ? (
              <img
                src={creature.sheetImageUrl}
                alt=""
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <FileImage className="h-6 w-6 text-textMuted" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-heading text-base font-semibold text-textH">
                {creature.name}
              </h2>
              {creature.unique ? (
                <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] font-semibold text-accent">
                  Única
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs text-textMuted">
              {[
                creature.size,
                creature.category,
                creature.challengeRating && `ND ${creature.challengeRating}`,
              ]
                .filter(Boolean)
                .join(" • ")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <MiniStat label="Init." value={signed(creature.initiativeBonus)} />
          <MiniStat label="CA" value={display(creature.armorClass)} />
          <MiniStat label="PV" value={display(creature.maxHp)} />
          <MiniStat label="DES" value={String(creature.abilityScores.dex)} />
        </div>

        {creature.actions.length > 0 ? (
          <div className="grid gap-1.5">
            {creature.actions.slice(0, 3).map((action) => (
              <p
                key={action.id}
                className="truncate text-sm leading-5 text-text"
                title={`${action.name}${action.description ? ` — ${action.description}` : ""}`}
              >
                <span className="font-semibold text-textH">{action.name}</span>
                {action.description ? ` — ${action.description}` : ""}
              </p>
            ))}
            {creature.actions.length > 3 ? (
              <span className="text-xs text-textMuted">
                +{creature.actions.length - 3} ação(ões)
              </span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-textMuted">Sem ações adicionadas.</p>
        )}
      </button>

      <div className="flex items-center justify-end gap-1 border-t border-border px-3 py-2">
        <Button
          size="icon"
          variant="ghost"
          title="Exportar JSON"
          onClick={onExportJson}
        >
          <FileJson className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="Exportar ZIP"
          onClick={onExportZip}
        >
          <Archive className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" title="Duplicar" onClick={onDuplicate}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" title="Editar" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" title="Remover" onClick={onDelete}>
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
    </article>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-2">
      <div className="text-[10px] font-semibold uppercase text-textMuted">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-textH">{value}</div>
    </div>
  )
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
}

function display(value: number | undefined): string {
  return value === undefined ? "—" : String(value)
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value)
}
