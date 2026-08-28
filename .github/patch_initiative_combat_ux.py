from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, text: str) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"anchor not found: {label}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# HP action dialog: one component for individual and bulk damage/heal/temp HP.
# ---------------------------------------------------------------------------
write("src/features/initiative/InitiativeHpActionDialog.tsx", r'''import { useMemo, useState } from "react"
import { HeartPulse, Plus, ShieldPlus, Trash2, Zap } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import {
  DAMAGE_TYPE_OPTIONS,
  damageAffinityLabel,
  damageTypeLabel,
  resolveDamage,
  type DamageAffinity,
  type DamageType,
} from "../../models/combat/Damage"
import type { InitiativeEntry } from "../../models/initiative/Initiative"
import type { InitiativeDamagePart } from "../session-runtime/initiativeSessionProtocol"

export type InitiativeHpActionMode = "damage" | "heal" | "temporary"

export type InitiativeHpActionPayload =
  | { mode: "damage"; parts: InitiativeDamagePart[] }
  | { mode: "heal" | "temporary"; amount: number }

export type InitiativeHpActionTarget = {
  entry: InitiativeEntry
  affinities: DamageAffinity[]
}

const selectClassName =
  "h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-textH shadow-theme-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25"

export function InitiativeHpActionDialog({
  targets,
  initialMode,
  onClose,
  onApply,
}: {
  targets: InitiativeHpActionTarget[]
  initialMode: InitiativeHpActionMode
  onClose: () => void
  onApply: (payload: InitiativeHpActionPayload) => void
}) {
  const [mode, setMode] = useState<InitiativeHpActionMode>(initialMode)
  const [amount, setAmount] = useState(1)
  const [parts, setParts] = useState<InitiativeDamagePart[]>([
    { amount: 1, damageType: undefined, magical: false },
  ])

  const previews = useMemo(() =>
    targets.map(({ entry, affinities }) => {
      if (mode !== "damage") return { entry, requested: amount, applied: amount, rules: [] as string[] }
      const resolved = parts.map((part) => resolveDamage(part.amount, part.damageType, affinities, { magical: part.magical }))
      return {
        entry,
        requested: resolved.reduce((total, result) => total + result.requested, 0),
        applied: resolved.reduce((total, result) => total + result.applied, 0),
        rules: Array.from(new Set(resolved.flatMap((result) => result.affinity ? [damageAffinityLabel(result.affinity)] : []))),
      }
    }),
  [amount, mode, parts, targets])

  const valid = mode === "damage"
    ? parts.length > 0 && parts.every((part) => Number.isInteger(part.amount) && part.amount > 0)
    : Number.isInteger(amount) && amount > 0

  function submit() {
    if (!valid) return
    if (mode === "damage") {
      onApply({ mode, parts })
      return
    }
    onApply({ mode, amount })
  }

  return (
    <Modal
      title={mode === "damage" ? "Aplicar dano" : mode === "heal" ? "Aplicar cura" : "Adicionar PV temporários"}
      onClose={onClose}
      className="max-w-3xl"
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={mode === "damage" ? "danger" : "secondary"} onClick={() => setMode("damage")}>
            <Zap className="h-4 w-4" /> Dano
          </Button>
          <Button size="sm" variant={mode === "heal" ? "primary" : "secondary"} onClick={() => setMode("heal")}>
            <HeartPulse className="h-4 w-4" /> Cura
          </Button>
          <Button size="sm" variant={mode === "temporary" ? "primary" : "secondary"} onClick={() => setMode("temporary")}>
            <ShieldPlus className="h-4 w-4" /> PV temp.
          </Button>
          <span className="ml-auto self-center text-xs text-textMuted">
            {targets.length} alvo{targets.length === 1 ? "" : "s"}
          </span>
        </div>

        {mode === "damage" ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-textH">Componentes de dano</div>
                <p className="mt-0.5 text-xs text-textMuted">Cada tipo é resolvido separadamente contra imunidade, resistência e vulnerabilidade.</p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setParts((current) => [...current, { amount: 1, damageType: undefined, magical: false }])}>
                <Plus className="h-4 w-4" /> Componente
              </Button>
            </div>

            {parts.map((part, index) => (
              <div key={index} className="grid gap-2 rounded-xl border border-border bg-bg-subtle p-3 sm:grid-cols-[7rem_minmax(0,1fr)_auto_auto] sm:items-end">
                <label className="grid gap-1 text-xs text-textMuted">
                  Valor
                  <Input
                    type="number"
                    min={1}
                    value={part.amount}
                    onChange={(event) => setParts((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, amount: Math.max(0, Math.trunc(Number(event.target.value))) } : entry))}
                  />
                </label>
                <label className="grid gap-1 text-xs text-textMuted">
                  Tipo
                  <select
                    className={selectClassName}
                    value={part.damageType ?? ""}
                    onChange={(event) => setParts((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, damageType: event.target.value ? event.target.value as DamageType : undefined } : entry))}
                  >
                    <option value="">Sem tipo / ignorar afinidades</option>
                    {DAMAGE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-bg px-3 text-xs text-textH">
                  <input
                    type="checkbox"
                    checked={part.magical === true}
                    onChange={(event) => setParts((current) => current.map((entry, currentIndex) => currentIndex === index ? { ...entry, magical: event.target.checked } : entry))}
                  />
                  Mágico
                </label>
                <Button size="icon" variant="ghost" title="Remover componente" disabled={parts.length === 1} onClick={() => setParts((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                  <Trash2 className="h-4 w-4 text-danger" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <label className="grid max-w-xs gap-1.5 text-sm text-textH">
            <span className="font-medium">Valor</span>
            <Input type="number" min={1} value={amount} autoFocus onChange={(event) => setAmount(Math.max(0, Math.trunc(Number(event.target.value))))} />
          </label>
        )}

        <section className="rounded-xl border border-border bg-bg-subtle p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-textMuted">Prévia</div>
          <div className="grid max-h-56 gap-2 overflow-y-auto">
            {previews.map(({ entry, requested, applied, rules }) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg px-3 py-2 text-xs">
                <span className="font-semibold text-textH">{entry.name}</span>
                <div className="flex flex-wrap items-center gap-2">
                  {mode === "damage" && parts.length === 1 && parts[0].damageType ? (
                    <span className="text-textMuted">{damageTypeLabel(parts[0].damageType)}</span>
                  ) : null}
                  <span className={applied !== requested ? "font-bold text-accent" : "font-semibold text-textH"}>
                    {requested}{applied !== requested ? ` → ${applied}` : ""}
                  </span>
                  {rules.map((rule) => <span key={rule} className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 font-semibold text-accent">{rule}</span>)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant={mode === "damage" ? "danger" : "primary"} disabled={!valid} onClick={submit}>
            {mode === "damage" ? "Aplicar dano" : mode === "heal" ? "Curar" : "Adicionar PV temporários"}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
''')

# ---------------------------------------------------------------------------
# Permanent combatant inspector.
# ---------------------------------------------------------------------------
write("src/features/initiative/InitiativeCombatantInspector.tsx", r'''import { HeartPulse, PanelRightClose, Pin, PinOff, ShieldPlus, Zap } from "lucide-react"

import { Button } from "../../components/ui/Button"
import { CreatureQuickSheet, type CombatQuickSheetData } from "../creatures/CreatureQuickSheet"
import { initiativeEntryDisplayName, type InitiativeEntry } from "../../models/initiative/Initiative"
import type { InitiativeHpActionMode } from "./InitiativeHpActionDialog"

export function InitiativeCombatantInspector({
  entry,
  data,
  pinned,
  followingTurn,
  preferImage,
  onTogglePinned,
  onCollapse,
  onHpAction,
}: {
  entry?: InitiativeEntry
  data?: CombatQuickSheetData
  pinned: boolean
  followingTurn: boolean
  preferImage?: boolean
  onTogglePinned: () => void
  onCollapse: () => void
  onHpAction: (mode: InitiativeHpActionMode) => void
}) {
  return (
    <aside className="sticky top-4 grid max-h-[calc(100dvh-2rem)] gap-3 overflow-y-auto rounded-xl border border-border bg-bg p-3 shadow-theme-lg">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-textMuted">Painel do combatente</div>
          <div className="mt-1 truncate text-sm font-semibold text-textH">
            {entry ? initiativeEntryDisplayName(entry, "master") : "Nenhum combatente selecionado"}
          </div>
          {entry ? (
            <div className="mt-1 text-[11px] text-textMuted">
              {followingTurn ? "Acompanhando o turno atual" : pinned ? "Ficha fixada" : "Selecionado manualmente"}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-1">
          {entry ? (
            <Button size="icon" variant={pinned ? "primary" : "ghost"} title={pinned ? "Voltar a seguir o turno" : "Fixar esta ficha"} onClick={onTogglePinned}>
              {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </Button>
          ) : null}
          <Button size="icon" variant="ghost" title="Ocultar painel" onClick={onCollapse}>
            <PanelRightClose className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {entry && data ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <Button size="sm" variant="danger" disabled={entry.currentHp === undefined} onClick={() => onHpAction("damage")}>
              <Zap className="h-4 w-4" /> Dano
            </Button>
            <Button size="sm" variant="primary" disabled={entry.currentHp === undefined} onClick={() => onHpAction("heal")}>
              <HeartPulse className="h-4 w-4" /> Cura
            </Button>
            <Button size="sm" variant="secondary" onClick={() => onHpAction("temporary")}>
              <ShieldPlus className="h-4 w-4" /> Temp.
            </Button>
          </div>
          <CreatureQuickSheet data={data} preferImage={preferImage} compact />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-textMuted">
          Inicie o combate ou clique em um participante para manter sua ficha aqui.
        </div>
      )}
    </aside>
  )
}
''')

# ---------------------------------------------------------------------------
# Quick sheet compact mode for sticky inspector.
# ---------------------------------------------------------------------------
path = "src/features/creatures/CreatureQuickSheet.tsx"
text = read(path)
text = replace_once(
    text,
    '''type CreatureQuickSheetProps = {
  data: CombatQuickSheetData
  preferImage?: boolean
}
''',
    '''type CreatureQuickSheetProps = {
  data: CombatQuickSheetData
  preferImage?: boolean
  compact?: boolean
}
''',
    "quick sheet compact prop",
)
text = replace_once(
    text,
    '''export function CreatureQuickSheet({
  data,
  preferImage = false,
}: CreatureQuickSheetProps) {
''',
    '''export function CreatureQuickSheet({
  data,
  preferImage = false,
  compact = false,
}: CreatureQuickSheetProps) {
''',
    "quick sheet compact destructure",
)
text = replace_once(
    text,
    '            <h3 className="font-heading text-2xl font-semibold text-textH">\n',
    '            <h3 className={`font-heading font-semibold text-textH ${compact ? "text-lg" : "text-2xl"}`}>\n',
    "quick sheet compact heading",
)
text = replace_once(
    text,
    '        <QuickSheetSummary data={data} />\n',
    '        <QuickSheetSummary data={data} compact={compact} />\n',
    "quick summary compact pass",
)
text = replace_once(
    text,
    'function QuickSheetSummary({ data }: { data: CombatQuickSheetData }) {\n',
    'function QuickSheetSummary({ data, compact = false }: { data: CombatQuickSheetData; compact?: boolean }) {\n',
    "quick summary compact signature",
)
text = replace_once(
    text,
    '      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">\n',
    '      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>\n',
    "quick stats compact grid",
)
text = replace_once(
    text,
    '        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">\n',
    '        <div className={`grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6"}`}>\n',
    "quick attributes compact grid",
)
text = replace_once(
    text,
    '      <div className="grid gap-3 md:grid-cols-2">\n',
    '      <div className={`grid gap-3 ${compact ? "grid-cols-1" : "md:grid-cols-2"}`}>\n',
    "quick info compact grid",
)
write(path, text)

# ---------------------------------------------------------------------------
# Initiative condition editor reuses CharacterCondition mechanical bonuses/presets.
# ---------------------------------------------------------------------------
path = "src/features/initiative/InitiativeDialogs.tsx"
text = read(path)
text = replace_once(
    text,
    'import { Textarea } from "../../components/ui/Textarea"\n',
    '''import { Textarea } from "../../components/ui/Textarea"
import type { BonusCollection } from "../../models/bonuses/Bonus"
import { BonusesFields } from "../characters/inventory/equipmentBonusFields"
import { STANDARD_CONDITION_PRESETS } from "../characters/characterSheet/standardConditionPresets"
''',
    "initiative dialog shared condition imports",
)
# Suggestions from shared presets.
start = text.index('const CONDITION_SUGGESTIONS = [')
end = text.index('\n]\n', start) + 3
text = text[:start] + 'const CONDITION_SUGGESTIONS = STANDARD_CONDITION_PRESETS.map((preset) => preset.name)\n' + text[end:]
text = replace_once(
    text,
    '''export type InitiativeConditionInput = {
  name: string
  description?: string
  duration: InitiativeConditionDuration
}
''',
    '''export type InitiativeConditionInput = {
  name: string
  description?: string
  behavior?: string
  source?: string
  notes?: string
  tags?: string[]
  bonuses?: BonusCollection
  duration: InitiativeConditionDuration
}
''',
    "initiative condition input mechanics",
)
text = replace_once(
    text,
    '''type ConditionDraft = {
  name: string
  description: string
  durationType: InitiativeConditionDuration["type"]
''',
    '''type ConditionDraft = {
  name: string
  description: string
  behavior: string
  source: string
  tags: string
  bonuses: BonusCollection
  durationType: InitiativeConditionDuration["type"]
''',
    "condition draft mechanics",
)
text = replace_once(
    text,
    '''    name: "",
    description: "",
    durationType: "manual",
''',
    '''    name: "",
    description: "",
    behavior: "",
    source: "Iniciativa",
    tags: "",
    bonuses: {},
    durationType: "manual",
''',
    "condition draft defaults",
)
text = replace_once(
    text,
    '''      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      duration: buildDuration(draft, targetEntryId),
''',
    '''      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      behavior: draft.behavior.trim() || undefined,
      source: draft.source.trim() || undefined,
      tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      bonuses: draft.bonuses,
      duration: buildDuration(draft, targetEntryId),
''',
    "condition submit mechanics",
)
# Add shared preset selector before condition input.
anchor = '''        <Field label="Condição">
'''
preset_ui = '''        <Field label="Condição padrão">
          <select
            className={selectClassName}
            value=""
            onChange={(event) => {
              const preset = STANDARD_CONDITION_PRESETS.find((entry) => entry.id === event.target.value)
              if (!preset) return
              setDraft((current) => ({
                ...current,
                name: preset.name,
                description: preset.description,
                behavior: preset.behavior,
                tags: preset.tags.join(", "),
              }))
            }}
          >
            <option value="">Preencher a partir das condições da ficha…</option>
            {STANDARD_CONDITION_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </Field>

'''
text = replace_once(text, anchor, preset_ui + anchor, "initiative shared preset selector")
# Add behavior/source/tags and bonuses after description.
anchor = '''        <Field label="Duração">
'''
mechanics_ui = '''        <Field label="Comportamento">
          <Textarea
            className="min-h-16"
            value={draft.behavior}
            onChange={(event) => setDraft((current) => ({ ...current, behavior: event.target.value }))}
            placeholder="Resumo da regra da condição."
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Fonte">
            <Input value={draft.source} onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))} />
          </Field>
          <Field label="Tags">
            <Input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="controle, veneno, magia" />
          </Field>
        </div>

        <BonusesFields
          bonuses={draft.bonuses}
          onChange={(bonuses) => setDraft((current) => ({ ...current, bonuses }))}
          description="Mesmos modificadores usados na ficha de personagem. Em criaturas, eles recalculam CA, ataques, dano, saves e demais estatísticas compatíveis."
        />

'''
text = replace_once(text, anchor, mechanics_ui + anchor, "initiative condition bonus editor")
write(path, text)

# ---------------------------------------------------------------------------
# Roster exposes compact HP actions.
# ---------------------------------------------------------------------------
path = "src/features/initiative/initiativeRosterTypes.ts"
text = read(path)
text = replace_once(
    text,
    '  onRename?: (entryId: string) => void\n',
    '  onRename?: (entryId: string) => void\n  onHpAction?: (entryId: string, mode: "damage" | "heal" | "temporary") => void\n',
    "roster hp action prop",
)
write(path, text)

path = "src/features/initiative/InitiativeTable.tsx"
text = read(path)
text = replace_once(text, 'import { Pencil, Play, Skull, Trash2 } from "lucide-react"\n', 'import { HeartPulse, Pencil, Play, Skull, Trash2, Zap } from "lucide-react"\n', "table hp icons")
text = replace_once(
    text,
    '  onRename,\n  selectedEntryIds,\n',
    '  onRename,\n  onHpAction,\n  selectedEntryIds,\n',
    "table hp prop destructure",
)
text = replace_once(
    text,
    '''            <HitPointEditor entry={entry} patchEntry={patchEntry} />
            <DeathSaveCounter
''',
    '''            <HitPointEditor entry={entry} patchEntry={patchEntry} />
            {onHpAction ? (
              <div className="flex gap-1">
                <Button size="sm" variant="danger" title="Aplicar dano" disabled={entry.currentHp === undefined} onClick={() => onHpAction(entry.id, "damage")}>
                  <Zap className="h-3.5 w-3.5" /> −
                </Button>
                <Button size="sm" variant="secondary" title="Aplicar cura" disabled={entry.currentHp === undefined} onClick={() => onHpAction(entry.id, "heal")}>
                  <HeartPulse className="h-3.5 w-3.5" /> +
                </Button>
              </div>
            ) : null}
            <DeathSaveCounter
''',
    "table hp compact controls",
)
write(path, text)

path = "src/features/initiative/InitiativeCards.tsx"
text = read(path)
text = replace_once(text, 'import { Pencil, Skull, Trash2 } from "lucide-react"\n', 'import { HeartPulse, Pencil, Skull, Trash2, Zap } from "lucide-react"\n', "card hp icons")
text = replace_once(
    text,
    '''                  </div>
                ) : null}

                {entry.downed && showPrivateStats ? (
''',
    '''                  </div>
                ) : null}

                {!readOnly && props.onHpAction && showPrivateStats ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="danger" disabled={entry.currentHp === undefined} onClick={() => props.onHpAction?.(entry.id, "damage")}>
                      <Zap className="h-3.5 w-3.5" /> Dano
                    </Button>
                    <Button size="sm" variant="secondary" disabled={entry.currentHp === undefined} onClick={() => props.onHpAction?.(entry.id, "heal")}>
                      <HeartPulse className="h-3.5 w-3.5" /> Cura
                    </Button>
                  </div>
                ) : null}

                {entry.downed && showPrivateStats ? (
''',
    "card hp compact controls",
)
write(path, text)

# ---------------------------------------------------------------------------
# Initiative view: semantic HP dispatcher, bulk buttons, sticky inspector.
# ---------------------------------------------------------------------------
path = "src/views/InitiativeView.tsx"
text = read(path)
text = replace_once(
    text,
    '''  Play,
  RotateCcw,
  Shield,
''',
    '''  Play,
  RotateCcw,
  Shield,
  PanelRightOpen,
  HeartPulse,
  Zap,
''',
    "initiative inspector icons",
)
text = replace_once(
    text,
    'import { InitiativeTable } from "../features/initiative/InitiativeTable"\n',
    '''import { InitiativeTable } from "../features/initiative/InitiativeTable"
import { InitiativeCombatantInspector } from "../features/initiative/InitiativeCombatantInspector"
import {
  InitiativeHpActionDialog,
  type InitiativeHpActionMode,
  type InitiativeHpActionPayload,
} from "../features/initiative/InitiativeHpActionDialog"
import { resolveDamage, type DamageAffinity } from "../models/combat/Damage"
''',
    "initiative combat ui imports",
)
# States.
text = replace_once(
    text,
    '''  const [renameValue, setRenameValue] = useState("")
  const [quickSheetEntryId, setQuickSheetEntryId] = useState<string>()
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
''',
    '''  const [renameValue, setRenameValue] = useState("")
  const [inspectedEntryId, setInspectedEntryId] = useState<string>()
  const [inspectorPinned, setInspectorPinned] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [hpAction, setHpAction] = useState<{ entryIds: string[]; mode: InitiativeHpActionMode }>()
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
''',
    "initiative inspector state",
)
# Computed inspector.
text = replace_once(
    text,
    '''  const renameTarget = session.entries.find((entry) => entry.id === renameTargetId)
  const quickSheetEntry = session.entries.find(
    (entry) => entry.id === quickSheetEntryId,
  )

  const quickSheetData = useMemo(
    () =>
      quickSheetEntry
        ? resolveQuickSheet(
            quickSheetEntry,
''',
    '''  const renameTarget = session.entries.find((entry) => entry.id === renameTargetId)
  const inspectedEntry = session.entries.find(
    (entry) => entry.id === inspectedEntryId,
  )

  const quickSheetData = useMemo(
    () =>
      inspectedEntry
        ? resolveQuickSheet(
            inspectedEntry,
''',
    "initiative inspector quick sheet",
)
text = text.replace('    [creatures, quickSheetEntry, visibleCharacters],\n', '    [creatures, inspectedEntry, visibleCharacters],\n', 1)
text = text.replace('    quickSheetEntry?.sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX) &&\n', '    inspectedEntry?.sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX) &&\n', 1)
# Effects follow turn and clean inspector.
anchor = '''  useEffect(() => {
    if (!session.activeEntryId || session.viewMode !== "cards") return
'''
follow_effect = '''  useEffect(() => {
    if (inspectorPinned) return
    const nextId = session.activeEntryId ?? session.entries[0]?.id
    if (nextId) setInspectedEntryId(nextId)
  }, [inspectorPinned, session.activeEntryId, session.entries])

  useEffect(() => {
    if (!inspectedEntryId) return
    if (session.entries.some((entry) => entry.id === inspectedEntryId)) return
    setInspectedEntryId(session.activeEntryId ?? session.entries[0]?.id)
    setInspectorPinned(false)
  }, [inspectedEntryId, session.activeEntryId, session.entries])

'''
text = replace_once(text, anchor, follow_effect + anchor, "initiative inspector follow effects")
# Add HP functions before clearCombat.
anchor = '''  async function clearCombat() {
'''
hp_functions = r'''  function openHpAction(entryIds: string[], mode: InitiativeHpActionMode) {
    if (!entryIds.length) return
    setHpAction({ entryIds, mode })
  }

  function damageAffinitiesForEntry(entry: InitiativeEntry): DamageAffinity[] {
    if (entry.sourceId?.startsWith(COMPENDIUM_SOURCE_PREFIX)) {
      const creatureId = entry.sourceId.slice(COMPENDIUM_SOURCE_PREFIX.length)
      return creatures.find((creature) => creature.id === creatureId)?.damageAffinities ?? []
    }
    if (entry.sourceId) {
      return visibleCharacters.find((character) => character.get("id") === entry.sourceId)?.get("sheet").damageAffinities ?? []
    }
    return []
  }

  function applyHpAction(payload: InitiativeHpActionPayload) {
    if (!hpAction?.entryIds.length) return
    const entryIds = hpAction.entryIds
    if (runtime?.initiativeState?.initialized) {
      runtime.dispatchInitiativeOperation(payload.mode === "damage"
        ? { type: "initiative.hp.apply", characterId: "session", entryIds, mode: "damage", parts: payload.parts }
        : { type: "initiative.hp.apply", characterId: "session", entryIds, mode: payload.mode, amount: payload.amount })
      setHpAction(undefined)
      return
    }

    updateSession((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (!entryIds.includes(entry.id)) return entry
        if (payload.mode === "damage") {
          const applied = payload.parts.reduce((total, part) => total + resolveDamage(part.amount, part.damageType, damageAffinitiesForEntry(entry), { magical: part.magical }).applied, 0)
          const temporary = Math.max(0, entry.temporaryHp ?? 0)
          const absorbed = Math.min(temporary, applied)
          return {
            ...entry,
            temporaryHp: Math.max(0, temporary - absorbed),
            currentHp: entry.currentHp === undefined ? entry.currentHp : Math.max(0, entry.currentHp - Math.max(0, applied - absorbed)),
          }
        }
        if (payload.mode === "heal") {
          if (entry.currentHp === undefined) return entry
          return { ...entry, currentHp: Math.min(entry.maxHp ?? entry.currentHp + payload.amount, entry.currentHp + payload.amount) }
        }
        return { ...entry, temporaryHp: Math.max(0, (entry.temporaryHp ?? 0) + payload.amount) }
      }),
      updatedAt: Date.now(),
    }))
    setHpAction(undefined)
  }

'''
text = replace_once(text, anchor, hp_functions + anchor, "initiative hp handlers")
# Roster props.
text = replace_once(
    text,
    '''    onOpen: setQuickSheetEntryId,
    onRename: openRename,
''',
    '''    onOpen: (entryId: string) => {
      setInspectedEntryId(entryId)
      setInspectorCollapsed(false)
    },
    onRename: openRename,
    onHpAction: (entryId: string, mode: InitiativeHpActionMode) => openHpAction([entryId], mode),
''',
    "roster inspector and hp handlers",
)
# Bulk damage heal buttons.
text = replace_once(
    text,
    '''            <Button size="sm" variant="ghost" onClick={() => setSelectedEntryIds(new Set())} disabled={!selectedEntryIds.size}>Limpar seleção</Button>
            <Button size="sm" onClick={() => setBulkConditionOpen(true)} disabled={!selectedEntryIds.size}>Aplicar condição</Button>
''',
    '''            <Button size="sm" variant="ghost" onClick={() => setSelectedEntryIds(new Set())} disabled={!selectedEntryIds.size}>Limpar seleção</Button>
            <Button size="sm" variant="danger" onClick={() => openHpAction(Array.from(selectedEntryIds), "damage")} disabled={!selectedEntryIds.size}>
              <Zap className="h-3.5 w-3.5" /> Dano
            </Button>
            <Button size="sm" variant="secondary" onClick={() => openHpAction(Array.from(selectedEntryIds), "heal")} disabled={!selectedEntryIds.size}>
              <HeartPulse className="h-3.5 w-3.5" /> Cura
            </Button>
            <Button size="sm" onClick={() => setBulkConditionOpen(true)} disabled={!selectedEntryIds.size}>Aplicar condição</Button>
''',
    "bulk damage heal buttons",
)
# Replace roster section with grid including inspector.
old_roster = '''      <section className="rounded-xl border border-border bg-bg shadow-theme-sm">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-textH">
              {session.entries.length} participante
              {session.entries.length === 1 ? "" : "s"}
            </div>
            <div className="text-xs text-textMuted">
              Clique no nome ou cartão para abrir a ficha rápida.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              title="Turno anterior"
              onClick={() => updateSession(rewindInitiativeTurn)}
              disabled={!session.started}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="primary"
              onClick={() => updateSession(advanceInitiativeTurn)}
              disabled={!session.started}
            >
              Próximo turno
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {session.entries.length === 0 ? (
          <EmptyRoster />
        ) : session.viewMode === "table" ? (
          <InitiativeTable {...rosterProps} />
        ) : (
          <InitiativeCards {...rosterProps} cardRefs={cardRefs} />
        )}
      </section>
'''
new_roster = '''      <div className={`grid items-start gap-4 ${inspectorCollapsed ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_26rem]"}`}>
        <section className="min-w-0 rounded-xl border border-border bg-bg shadow-theme-sm">
          <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-sm font-semibold text-textH">
                  {session.entries.length} participante{session.entries.length === 1 ? "" : "s"}
                </div>
                {inspectorCollapsed ? (
                  <Button size="sm" variant="secondary" onClick={() => setInspectorCollapsed(false)}>
                    <PanelRightOpen className="h-4 w-4" /> Mostrar ficha
                  </Button>
                ) : null}
              </div>
              <div className="text-xs text-textMuted">
                A ficha à direita acompanha o turno; clique em outro participante para inspecioná-lo ou fixe a ficha.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="icon" title="Turno anterior" onClick={() => updateSession(rewindInitiativeTurn)} disabled={!session.started}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button variant="primary" onClick={() => updateSession(advanceInitiativeTurn)} disabled={!session.started}>
                Próximo turno <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {session.entries.length === 0 ? (
            <EmptyRoster />
          ) : session.viewMode === "table" ? (
            <InitiativeTable {...rosterProps} />
          ) : (
            <InitiativeCards {...rosterProps} cardRefs={cardRefs} />
          )}
        </section>

        {!inspectorCollapsed ? (
          <InitiativeCombatantInspector
            entry={inspectedEntry}
            data={quickSheetData}
            pinned={inspectorPinned}
            followingTurn={!inspectorPinned && Boolean(inspectedEntry?.id && inspectedEntry.id === session.activeEntryId)}
            preferImage={quickSheetPrefersImage}
            onTogglePinned={() => {
              if (inspectorPinned) {
                setInspectorPinned(false)
                setInspectedEntryId(session.activeEntryId ?? inspectedEntry?.id)
              } else {
                setInspectorPinned(true)
              }
            }}
            onCollapse={() => setInspectorCollapsed(true)}
            onHpAction={(mode) => inspectedEntry && openHpAction([inspectedEntry.id], mode)}
          />
        ) : null}
      </div>
'''
text = replace_once(text, old_roster, new_roster, "initiative permanent inspector layout")
# Remove modal quick sheet and add hp dialog near end.
old_modal = '''      {quickSheetEntry && quickSheetData ? (
        <Modal
          title={`Ficha rápida — ${initiativeEntryDisplayName(quickSheetEntry, "master")}`}
          onClose={() => setQuickSheetEntryId(undefined)}
          className="max-w-5xl"
        >
          <CreatureQuickSheet
            data={quickSheetData}
            preferImage={quickSheetPrefersImage}
          />
        </Modal>
      ) : null}
'''
new_modal = '''      {hpAction ? (
        <InitiativeHpActionDialog
          targets={session.entries
            .filter((entry) => hpAction.entryIds.includes(entry.id))
            .map((entry) => ({ entry, affinities: damageAffinitiesForEntry(entry) }))}
          initialMode={hpAction.mode}
          onClose={() => setHpAction(undefined)}
          onApply={applyHpAction}
        />
      ) : null}
'''
text = replace_once(text, old_modal, new_modal, "replace quick sheet modal with hp dialog")
# Remove unused direct CreatureQuickSheet import symbol from view import block, keep builder/types.
text = text.replace('  CreatureQuickSheet,\n', '', 1)
write(path, text)

print("initiative combat UX patch applied")
