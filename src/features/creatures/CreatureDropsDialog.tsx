import { PackagePlus, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Select as SharedSelect } from "../../components/ui/Select"
import { useCreationEditor } from "../creation/CreationEditorProvider"
import { ItemCreationDialog } from "../items/ItemCreationDialog"
import {
  buildSessionCompendiumItems,
  instantiateSessionCompendiumItem,
  type SessionCompendiumItem,
} from "../items/sessionItemCompendium"
import {
  createCreatureDropGroup,
  normalizeCreatureDrops,
  type CreatureDropGroup,
  type CreatureDrops,
} from "../../models/creatures/CreatureDrops"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
import type { Itemmable } from "../../models/items/item"
import type { SessionItemCompendiumEntry } from "../../api/session-item-compendium"

type DropTarget =
  | { kind: "guaranteed" }
  | { kind: "roll"; groupId: string }

export function CreatureDropsDialog({
  creature,
  onClose,
  onSave,
}: {
  creature: CompendiumCreature
  onClose: () => void
  onSave: (creature: CompendiumCreature) => void
}) {
  const editor = useCreationEditor()
  const [drops, setDrops] = useState<CreatureDrops>(() =>
    normalizeCreatureDrops(creature.drops),
  )
  const [manualTarget, setManualTarget] = useState<DropTarget | null>(null)
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string>>({})

  const compendiumEntries = useMemo<SessionItemCompendiumEntry[]>(
    () => (editor.draft?.itemCompendium ?? []).map((entry) => ({
      id: entry.templateId,
      templateId: entry.templateId,
      item: entry.item,
      custom: entry.custom,
      visibility: entry.visibility,
    })),
    [editor.draft?.itemCompendium],
  )
  const compendium = useMemo(
    () => buildSessionCompendiumItems(compendiumEntries),
    [compendiumEntries],
  )

  function updateItems(target: DropTarget, updater: (items: Itemmable[]) => Itemmable[]) {
    setDrops((current) => {
      if (target.kind === "guaranteed") {
        return { ...current, guaranteed: updater(current.guaranteed) }
      }
      return {
        ...current,
        rollGroups: current.rollGroups.map((group) =>
          group.id === target.groupId
            ? { ...group, items: updater(group.items) }
            : group,
        ),
      }
    })
  }

  function addCompendiumItem(target: DropTarget, entry: SessionCompendiumItem) {
    updateItems(target, (items) => [
      ...items,
      instantiateSessionCompendiumItem(entry),
    ])
  }

  function addManualItem(target: DropTarget, item: Itemmable) {
    updateItems(target, (items) => [
      ...items,
      {
        ...structuredClone(item),
        id: item.id || crypto.randomUUID(),
        quantity: Math.max(1, Number(item.quantity) || 1),
      },
    ])
    setManualTarget(null)
  }

  function addRollGroup() {
    setDrops((current) => ({
      ...current,
      rollGroups: [...current.rollGroups, createCreatureDropGroup()],
    }))
  }

  function removeRollGroup(groupId: string) {
    setDrops((current) => ({
      ...current,
      rollGroups: current.rollGroups.filter((group) => group.id !== groupId),
    }))
  }

  function save() {
    onSave({
      ...creature,
      drops: normalizeCreatureDrops(drops),
      updatedAt: Date.now(),
    })
  }

  return (
    <>
      <Modal
        title={`Drops — ${creature.name}`}
        onClose={onClose}
        className="max-w-5xl"
      >
        <div className="grid gap-5">
          <div className="rounded-xl border border-accentBorder bg-accentBg p-4 text-sm leading-6 text-text">
            O grupo padrão sempre é enviado ao chão quando esta criatura morre.
            Se houver grupos por rolagem, a sessão rola automaticamente 1dN e
            também envia ao chão o grupo correspondente ao resultado.
          </div>

          <DropGroupEditor
            title="Grupo padrão"
            description="Sempre dropado."
            target={{ kind: "guaranteed" }}
            items={drops.guaranteed}
            compendium={compendium}
            selectedTemplateId={selectedByGroup.guaranteed ?? ""}
            onSelectTemplate={(value) =>
              setSelectedByGroup((current) => ({ ...current, guaranteed: value }))
            }
            onAddCompendium={(entry) => addCompendiumItem({ kind: "guaranteed" }, entry)}
            onAddManual={() => setManualTarget({ kind: "guaranteed" })}
            onChangeItems={(updater) => updateItems({ kind: "guaranteed" }, updater)}
          />

          <section className="grid gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-textH">Grupos por rolagem</h3>
                <p className="mt-1 text-xs text-textMuted">
                  {drops.rollGroups.length
                    ? `Na morte será rolado 1d${drops.rollGroups.length}.`
                    : "Sem grupos opcionais: nenhuma rolagem adicional será feita."}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={addRollGroup}>
                <Plus className="h-4 w-4" />
                Adicionar grupo
              </Button>
            </div>

            {drops.rollGroups.map((group, index) => (
              <DropGroupEditor
                key={group.id}
                title={`Resultado ${index + 1}`}
                description={`Cai quando 1d${drops.rollGroups.length || 1} resultar em ${index + 1}.`}
                target={{ kind: "roll", groupId: group.id }}
                items={group.items}
                compendium={compendium}
                selectedTemplateId={selectedByGroup[group.id] ?? ""}
                onSelectTemplate={(value) =>
                  setSelectedByGroup((current) => ({ ...current, [group.id]: value }))
                }
                onAddCompendium={(entry) =>
                  addCompendiumItem({ kind: "roll", groupId: group.id }, entry)
                }
                onAddManual={() =>
                  setManualTarget({ kind: "roll", groupId: group.id })
                }
                onChangeItems={(updater) =>
                  updateItems({ kind: "roll", groupId: group.id }, updater)
                }
                onRemoveGroup={() => removeRollGroup(group.id)}
              />
            ))}
          </section>

          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={save}>Salvar drops</Button>
          </div>
        </div>
      </Modal>

      <ItemCreationDialog
        open={manualTarget !== null}
        title="Adicionar item manual ao drop"
        enableJson
        saveLabel="Adicionar ao grupo"
        onClose={() => setManualTarget(null)}
        onSave={(item) => {
          if (manualTarget) addManualItem(manualTarget, item)
        }}
      />
    </>
  )
}

function DropGroupEditor({
  title,
  description,
  items,
  compendium,
  selectedTemplateId,
  onSelectTemplate,
  onAddCompendium,
  onAddManual,
  onChangeItems,
  onRemoveGroup,
}: {
  title: string
  description: string
  target: DropTarget
  items: Itemmable[]
  compendium: SessionCompendiumItem[]
  selectedTemplateId: string
  onSelectTemplate: (value: string) => void
  onAddCompendium: (entry: SessionCompendiumItem) => void
  onAddManual: () => void
  onChangeItems: (updater: (items: Itemmable[]) => Itemmable[]) => void
  onRemoveGroup?: () => void
}) {
  const selectedEntry = compendium.find((entry) => entry.item.id === selectedTemplateId)

  return (
    <section className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-textH">{title}</h4>
          <p className="mt-1 text-xs text-textMuted">{description}</p>
        </div>
        {onRemoveGroup ? (
          <Button size="sm" variant="ghost" onClick={onRemoveGroup} title="Remover grupo">
            <Trash2 className="h-4 w-4 text-danger" />
            Remover grupo
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <SharedSelect
          className="h-10 min-w-0 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
          value={selectedTemplateId}
          onChange={(event) => onSelectTemplate(event.target.value)}
        >
          <option value="">Selecionar item do compêndio</option>
          {compendium.map((entry) => (
            <option key={`${entry.custom ? "custom" : "standard"}-${entry.item.id}`} value={entry.item.id}>
              {entry.item.name}
            </option>
          ))}
        </SharedSelect>
        <Button
          size="sm"
          variant="secondary"
          disabled={!selectedEntry}
          onClick={() => selectedEntry && onAddCompendium(selectedEntry)}
        >
          <PackagePlus className="h-4 w-4" />
          Do compêndio
        </Button>
        <Button size="sm" variant="secondary" onClick={onAddManual}>
          <Plus className="h-4 w-4" />
          Item manual
        </Button>
      </div>

      {items.length ? (
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="grid gap-2 rounded-lg border border-border bg-bg p-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-textH">{item.name}</div>
                <div className="mt-1 text-[11px] text-textMuted">
                  {item.compendiumItemId ? "Compêndio" : "Manual"} · {item.weight} kg/un.
                </div>
              </div>
              <label className="grid gap-1 text-[11px] text-textMuted">
                Quantidade
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  onChange={(event) => {
                    const quantity = Math.max(1, Math.trunc(Number(event.target.value) || 1))
                    onChangeItems((current) =>
                      current.map((entry) =>
                        entry.id === item.id ? { ...entry, quantity } : entry,
                      ),
                    )
                  }}
                />
              </label>
              <Button
                size="icon"
                variant="ghost"
                title="Remover item do grupo"
                onClick={() =>
                  onChangeItems((current) => current.filter((entry) => entry.id !== item.id))
                }
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-textMuted">
          Este grupo não possui itens. Um resultado vazio é permitido.
        </div>
      )}
    </section>
  )
}
