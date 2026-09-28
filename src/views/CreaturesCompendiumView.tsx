import { Select as SharedSelect } from "../components/ui/Select"
import {
  Archive,
  BookOpen,
  Copy,
  FileImage,
  FileJson,
  Folder,
  FolderPlus,
  PackageOpen,
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
import { useOptionalCreationEditor } from "../features/creation/CreationEditorProvider"
import { CreatureCompendiumTransferBar } from "../features/creatures/CreatureCompendiumTransferBar"
import { CreatureDropsDialog } from "../features/creatures/CreatureDropsDialog"
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

const ALL_FOLDERS = "__all_folders__"
const UNFILED = "__unfiled__"
const FOLDER_PREFIX = "folder:"

export function CreaturesCompendiumView() {
  const { campaignCapabilities, sessionMembers } = useSyncContext()
  const creationEditor = useOptionalCreationEditor()
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
  const [folderFilter, setFolderFilter] = useState(ALL_FOLDERS)
  const [editingCreature, setEditingCreature] = useState<CompendiumCreature>()
  const [viewingCreature, setViewingCreature] = useState<CompendiumCreature>()
  const [dropCreature, setDropCreature] = useState<CompendiumCreature>()

  const folderNames = useMemo(
    () =>
      mergeFolderNames([
        ...(creationEditor?.draft?.creatureFolders ?? []),
        ...creatures.flatMap((creature) =>
          creature.folder?.trim() ? [creature.folder] : [],
        ),
      ]),
    [creationEditor?.draft?.creatureFolders, creatures],
  )

  const filteredCreatures = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query)
    const selectedFolder = folderFromFilter(folderFilter)

    return creatures.filter((creature) => {
      const featureText = creatureFeatureSearchText([
        ...creature.traits,
        ...creature.actions,
        ...creature.bonusActions,
        ...creature.reactions,
        ...creature.legendaryActions,
      ])
      const searchableText = normalizeSearchText(
        `${creature.name} ${creature.category} ${creature.folder ?? ""} ${featureText}`,
      )
      const matchesQuery =
        !normalizedQuery || searchableText.includes(normalizedQuery)
      const matchesSide =
        sideFilter === "all" || creature.defaultSide === sideFilter
      const matchesFolder =
        folderFilter === ALL_FOLDERS
          ? true
          : folderFilter === UNFILED
            ? !normalizeFolderName(creature.folder)
            : sameFolder(creature.folder, selectedFolder)

      return matchesQuery && matchesSide && matchesFolder
    })
  }, [creatures, folderFilter, query, sideFilter])

  const groupedCreatures = useMemo(() => {
    const groups: Array<{
      folder?: string
      creatures: CompendiumCreature[]
    }> = []

    const selectedFolder = folderFromFilter(folderFilter)
    const candidateFolders =
      folderFilter === ALL_FOLDERS
        ? folderNames
        : selectedFolder
          ? [selectedFolder]
          : []

    for (const folder of candidateFolders) {
      const entries = filteredCreatures.filter((creature) =>
        sameFolder(creature.folder, folder),
      )
      if (
        entries.length > 0 ||
        (!query.trim() && sideFilter === "all")
      ) {
        groups.push({ folder, creatures: entries })
      }
    }

    if (folderFilter === ALL_FOLDERS || folderFilter === UNFILED) {
      const unfiled = filteredCreatures.filter(
        (creature) => !normalizeFolderName(creature.folder),
      )
      if (unfiled.length > 0 || (folderFilter === UNFILED && !query.trim())) {
        groups.push({ creatures: unfiled })
      }
    }

    return groups
  }, [filteredCreatures, folderFilter, folderNames, query, sideFilter])

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
        Carregando compêndio…
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

  function createFolder() {
    const requested = window.prompt("Nome da nova pasta:")
    if (requested === null) return

    const folder = normalizeFolderName(requested)
    if (!folder) {
      window.alert("Informe um nome para a pasta.")
      return
    }

    if (creationEditor?.draft) {
      creationEditor.updateDraft((draft) => ({
        ...draft,
        creatureFolders: mergeFolderNames([
          ...(draft.creatureFolders ?? []),
          folder,
        ]),
      }))
    }

    setFolderFilter(folderFilterValue(folder))
  }

  function renameFolder(folder: string) {
    const requested = window.prompt("Novo nome da pasta:", folder)
    if (requested === null) return

    const nextFolder = normalizeFolderName(requested)
    if (!nextFolder) {
      window.alert("Informe um nome para a pasta.")
      return
    }
    if (sameFolder(folder, nextFolder)) return

    if (creationEditor?.draft) {
      creationEditor.updateDraft((draft) => ({
        ...draft,
        creatureFolders: mergeFolderNames([
          ...(draft.creatureFolders ?? []).filter(
            (entry) => !sameFolder(entry, folder),
          ),
          nextFolder,
        ]),
        creatureCompendium: draft.creatureCompendium.map((creature) =>
          sameFolder(creature.folder, folder)
            ? {
                ...creature,
                folder: nextFolder,
                updatedAt: Date.now(),
              }
            : creature,
        ),
      }))
    } else {
      upsertCreatures(
        creatures
          .filter((creature) => sameFolder(creature.folder, folder))
          .map((creature) => ({
            ...creature,
            folder: nextFolder,
          })),
      )
    }

    if (sameFolder(folderFromFilter(folderFilter), folder)) {
      setFolderFilter(folderFilterValue(nextFolder))
    }
  }

  function deleteFolder(folder: string) {
    if (
      !window.confirm(
        `Remover a pasta "${folder}"? As criaturas dela ficarão em "Sem pasta".`,
      )
    ) {
      return
    }

    if (creationEditor?.draft) {
      creationEditor.updateDraft((draft) => ({
        ...draft,
        creatureFolders: (draft.creatureFolders ?? []).filter(
          (entry) => !sameFolder(entry, folder),
        ),
        creatureCompendium: draft.creatureCompendium.map((creature) =>
          sameFolder(creature.folder, folder)
            ? {
                ...creature,
                folder: undefined,
                updatedAt: Date.now(),
              }
            : creature,
        ),
      }))
    } else {
      upsertCreatures(
        creatures
          .filter((creature) => sameFolder(creature.folder, folder))
          .map((creature) => ({
            ...creature,
            folder: undefined,
          })),
      )
    }

    if (sameFolder(folderFromFilter(folderFilter), folder)) {
      setFolderFilter(ALL_FOLDERS)
    }
  }

  function moveCreatureToFolder(creature: CompendiumCreature) {
    const requested = window.prompt(
      'Nome da pasta. Deixe vazio para mover para "Sem pasta":',
      creature.folder ?? "",
    )
    if (requested === null) return

    const folder = normalizeFolderName(requested)
    if (sameFolder(creature.folder, folder)) return

    if (creationEditor?.draft) {
      creationEditor.updateDraft((draft) => ({
        ...draft,
        creatureFolders: folder
          ? mergeFolderNames([...(draft.creatureFolders ?? []), folder])
          : draft.creatureFolders,
        creatureCompendium: draft.creatureCompendium.map((entry) =>
          entry.id === creature.id
            ? {
                ...entry,
                folder: folder || undefined,
                updatedAt: Date.now(),
              }
            : entry,
        ),
      }))
      return
    }

    upsertCreature({
      ...creature,
      folder: folder || undefined,
    })
  }

  const selectedFolderForNewCreature = folderFromFilter(folderFilter)

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
            </div>
            <p className="mt-2 max-w-3xl text-sm text-text">
              Fichas enxutas para a Criação: estatísticas de combate, habilidades,
              ações, drops, notas e uma imagem opcional da ficha original.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={createFolder}>
              <FolderPlus className="h-4 w-4" />
              Nova pasta
            </Button>
            <Button
              variant="primary"
              onClick={() =>
                setEditingCreature(
                  createCompendiumCreature({
                    folder: selectedFolderForNewCreature,
                  }),
                )
              }
            >
              <Plus className="h-4 w-4" />
              Nova criatura
            </Button>
          </div>
        </div>
      </section>

      <CreatureCompendiumTransferBar
        creatures={creatures}
        onImport={upsertCreatures}
      />

      <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem_14rem]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-textMuted" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, categoria, pasta ou habilidade…"
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

          <SharedSelect
            className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"
            value={folderFilter}
            onChange={(event) => setFolderFilter(event.target.value)}
          >
            <option value={ALL_FOLDERS}>Todas as pastas</option>
            <option value={UNFILED}>Sem pasta</option>
            {folderNames.map((folder) => (
              <option key={folder} value={folderFilterValue(folder)}>
                {folder}
              </option>
            ))}
          </SharedSelect>
        </div>
      </section>

      {groupedCreatures.length > 0 ? (
        <div className="grid gap-4">
          {groupedCreatures.map((group) => (
            <section
              key={group.folder ?? UNFILED}
              className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Folder className="h-5 w-5 shrink-0 text-accent" />
                  <h2 className="truncate font-heading text-base font-semibold text-textH">
                    {group.folder ?? "Sem pasta"}
                  </h2>
                  <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[10px] text-textMuted">
                    {group.creatures.length}
                  </span>
                </div>

                {group.folder ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => renameFolder(group.folder!)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Renomear
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteFolder(group.folder!)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" />
                      Remover pasta
                    </Button>
                  </div>
                ) : null}
              </div>

              {group.creatures.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.creatures.map((creature) => (
                    <CreatureCard
                      key={creature.id}
                      creature={creature}
                      onView={() => setViewingCreature(creature)}
                      onMove={() => moveCreatureToFolder(creature)}
                      onDrops={() => setDropCreature(creature)}
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
                            `Remover ${creature.name} do compêndio?`,
                          )
                        ) {
                          deleteCreature(creature.id)
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-lg border border-dashed border-border bg-bg-subtle px-4 py-6 text-center text-sm text-textMuted">
                  Pasta vazia. Crie uma criatura aqui ou mova uma criatura existente para esta pasta.
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-dashed border-border bg-bg p-10 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-textMuted" />
          <h2 className="mt-3 text-sm font-semibold text-textH">
            {creatures.length === 0 && folderNames.length === 0
              ? "O compêndio está vazio"
              : "Nenhuma criatura encontrada"}
          </h2>
          <p className="mt-1 text-sm text-text">
            {creatures.length === 0 && folderNames.length === 0
              ? "Crie fichas rápidas, organize-as em pastas ou importe arquivos JSON e ZIP."
              : "Tente alterar a busca, o lado ou a pasta selecionada."}
          </p>
        </section>
      )}

      {editingCreature ? (
        <CreatureEditorDialog
          creature={editingCreature}
          ownerOptions={sessionMembers.map((member) => ({
            id: member.id,
            name: member.name,
          }))}
          onClose={() => setEditingCreature(undefined)}
          onSave={(creature) => {
            const normalizedFolder = normalizeFolderName(creature.folder)
            if (creationEditor?.draft) {
              creationEditor.updateDraft((draft) => {
                const nextCreature = {
                  ...creature,
                  folder: normalizedFolder || undefined,
                  updatedAt: Date.now(),
                }
                const byId = new Map(
                  draft.creatureCompendium.map((entry) => [entry.id, entry]),
                )
                byId.set(nextCreature.id, nextCreature)
                return {
                  ...draft,
                  creatureFolders: normalizedFolder
                    ? mergeFolderNames([
                        ...(draft.creatureFolders ?? []),
                        normalizedFolder,
                      ])
                    : draft.creatureFolders,
                  creatureCompendium: [...byId.values()].sort((left, right) =>
                    left.name.localeCompare(right.name),
                  ),
                }
              })
            } else {
              upsertCreature({
                ...creature,
                folder: normalizedFolder || undefined,
              })
            }
            setEditingCreature(undefined)
          }}
        />
      ) : null}

      {dropCreature ? (
        <CreatureDropsDialog
          creature={dropCreature}
          onClose={() => setDropCreature(undefined)}
          onSave={(creature) => {
            upsertCreature(creature)
            setDropCreature(undefined)
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
  onMove,
  onDrops,
  onEdit,
  onDuplicate,
  onExportJson,
  onExportZip,
  onDelete,
}: {
  creature: CompendiumCreature
  onView: () => void
  onMove: () => void
  onDrops: () => void
  onEdit: () => void
  onDuplicate: () => void
  onExportJson: () => void
  onExportZip: () => void
  onDelete: () => void
}) {
  const guaranteedCount = creature.drops?.guaranteed?.length ?? 0
  const rollGroupCount = creature.drops?.rollGroups?.length ?? 0

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
              {guaranteedCount || rollGroupCount ? (
                <span className="rounded-full border border-border bg-bg-subtle px-2 py-0.5 text-[10px] text-textMuted">
                  Drops: {guaranteedCount} fixo{guaranteedCount === 1 ? "" : "s"}
                  {rollGroupCount ? ` + 1d${rollGroupCount}` : ""}
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
          title="Mover para pasta"
          onClick={onMove}
        >
          <Folder className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          title="Configurar drops"
          onClick={onDrops}
        >
          <PackageOpen className="h-4 w-4" />
        </Button>
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

function normalizeFolderName(value?: string): string {
  return value?.trim().replace(/\s+/g, " ") ?? ""
}

function sameFolder(left?: string, right?: string): boolean {
  const normalizedLeft = normalizeFolderName(left)
  const normalizedRight = normalizeFolderName(right)
  if (!normalizedLeft || !normalizedRight) {
    return normalizedLeft === normalizedRight
  }
  return normalizedLeft.localeCompare(normalizedRight, "pt-BR", {
    sensitivity: "accent",
  }) === 0
}

function mergeFolderNames(values: string[]): string[] {
  const byKey = new Map<string, string>()
  for (const value of values) {
    const folder = normalizeFolderName(value)
    if (!folder) continue
    const key = folder.toLocaleLowerCase("pt-BR")
    if (!byKey.has(key)) byKey.set(key, folder)
  }
  return [...byKey.values()].sort((left, right) =>
    left.localeCompare(right, "pt-BR"),
  )
}

function folderFilterValue(folder: string): string {
  return `${FOLDER_PREFIX}${folder}`
}

function folderFromFilter(value: string): string | undefined {
  return value.startsWith(FOLDER_PREFIX)
    ? value.slice(FOLDER_PREFIX.length)
    : undefined
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
