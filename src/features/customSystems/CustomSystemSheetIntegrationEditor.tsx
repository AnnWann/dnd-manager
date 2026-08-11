import { Plus, Trash2 } from "lucide-react"
import type { ReactNode } from "react"

import {
  listCustomFormulaVariables,
  validateCustomFormula,
} from "../../lib/customSystems"
import type { AbilityActionKind } from "../../models/abilities/Ability"
import type { ConditionDurationType } from "../../models/characters/CharacterCondition"
import type { CustomAbilityResourceChangeDefinition } from "../../models/customSystems/CustomAbilityDefinition"
import type {
  CustomNativeStatOverrideDefinition,
  CustomNativeStatTarget,
  CustomSystemActionDefinition,
  CustomSystemConditionChangeDefinition,
  CustomSystemDefinition,
} from "../../models/customSystems/CustomSystemDefinition"
import { FormulaVariablePicker } from "./FormulaVariablePicker"

const STATS: Array<[CustomNativeStatTarget, string]> = [
  ["initiative", "Iniciativa"],
  ["armorClass", "Classe de Armadura"],
  ["mobility", "Mobilidade"],
  ["passivePerception", "Percepção passiva"],
]

const ACTIONS: Array<[AbilityActionKind | "", string]> = [
  ["", "Não exibir como ação"],
  ["action", "Ação"],
  ["bonusAction", "Ação bônus"],
  ["reaction", "Reação"],
  ["free", "Ação livre"],
  ["legendaryAction", "Ação lendária"],
  ["legendaryReaction", "Reação lendária"],
  ["legendaryResistance", "Resistência lendária"],
]

const DURATIONS: Array<[ConditionDurationType, string]> = [
  ["permanent", "Permanente"],
  ["rounds", "Rodadas"],
  ["turns", "Turnos"],
  ["minutes", "Minutos"],
  ["hours", "Horas"],
  ["days", "Dias"],
  ["until-start-of-turn", "Até o início do turno"],
  ["until-end-of-turn", "Até o fim do turno"],
  ["until-save", "Até passar em um teste"],
  ["concentration", "Concentração"],
  ["custom", "Personalizada"],
]

const NATIVE_RESOURCES = [
  ["hitPoints", "Pontos de vida"],
  ["temporaryHitPoints", "Pontos de vida temporários"],
  ["inspiration", "Inspiração"],
  ["exhaustion", "Exaustão"],
] as const

export function CustomSystemSheetIntegrationEditor({
  draft,
  setDraft,
}: {
  draft: CustomSystemDefinition
  setDraft: (definition: CustomSystemDefinition) => void
  definitions: CustomSystemDefinition[]
}) {
  const overrides = draft.nativeStatOverrides ?? []
  const actions = draft.actions ?? []

  return (
    <div className="grid gap-5">
      <Section
        title="Fórmulas da ficha nativa"
        description="Substitua cálculos existentes enquanto o sistema estiver ativo. Ex.: Iniciativa = SAB + DEX pode usar character.attributeModifier.wis + character.attributeModifier.dex."
        action={
          <AddButton
            label="Fórmula"
            onClick={() =>
              setDraft({
                ...draft,
                nativeStatOverrides: [...overrides, newOverride(overrides)],
              })
            }
          />
        }
      >
        <div className="grid gap-3">
          {overrides.map((override, index) => (
            <OverrideRow
              key={override.id}
              definition={draft}
              value={override}
              onChange={(next) =>
                setDraft({
                  ...draft,
                  nativeStatOverrides: overrides.map((entry, current) =>
                    current === index ? next : entry,
                  ),
                })
              }
              onRemove={() =>
                setDraft({
                  ...draft,
                  nativeStatOverrides: overrides.filter((_, current) => current !== index),
                })
              }
            />
          ))}
          {!overrides.length ? <Empty>Nenhuma fórmula alternativa.</Empty> : null}
        </div>
      </Section>

      <Section
        title="Botões do sistema"
        description="Botões aparecem na seção Ações da ficha. Podem gastar, gerar ou definir recursos e aplicar/remover estados."
        action={
          <AddButton
            label="Botão"
            onClick={() =>
              setDraft({ ...draft, actions: [...actions, newAction(actions)] })
            }
          />
        }
      >
        <div className="grid gap-4">
          {actions.map((action, index) => (
            <ActionRow
              key={action.id}
              definition={draft}
              value={action}
              onChange={(next) =>
                setDraft({
                  ...draft,
                  actions: actions.map((entry, current) =>
                    current === index ? next : entry,
                  ),
                })
              }
              onRemove={() =>
                setDraft({
                  ...draft,
                  actions: actions.filter((_, current) => current !== index),
                })
              }
            />
          ))}
          {!actions.length ? <Empty>Nenhum botão criado.</Empty> : null}
        </div>
      </Section>

      <Section
        title="Habilidades na seção de ações"
        description="Escolha uma categoria para transformar cada habilidade adquirida desse tipo em um botão. Os usos e efeitos de recurso continuam vindo da configuração da habilidade."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {draft.abilityTypes.map((type, index) => (
            <div key={type.id} className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="text-sm font-semibold text-textH">{type.name}</div>
              <Select
                label="Categoria na ficha"
                value={normalizeActionKind(type.activation?.actionKind) ?? ""}
                options={ACTIONS}
                onChange={(actionKind) =>
                  setDraft({
                    ...draft,
                    abilityTypes: draft.abilityTypes.map((entry, current) =>
                      current === index
                        ? {
                            ...entry,
                            activation: {
                              ...entry.activation,
                              kind: actionKind ? entry.activation?.kind ?? "active" : entry.activation?.kind,
                              actionKind: (actionKind || undefined) as AbilityActionKind | undefined,
                            },
                          }
                        : entry,
                    ),
                  })
                }
              />
            </div>
          ))}
          {!draft.abilityTypes.length ? <Empty>Nenhum tipo de habilidade criado.</Empty> : null}
        </div>
      </Section>
    </div>
  )
}

function OverrideRow({ definition, value, onChange, onRemove }: {
  definition: CustomSystemDefinition
  value: CustomNativeStatOverrideDefinition
  onChange: (value: CustomNativeStatOverrideDefinition) => void
  onRemove: () => void
}) {
  const error = value.formula.trim()
    ? validateCustomFormula(value.formula, definition)
    : "Informe uma fórmula."

  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="grid gap-3 lg:grid-cols-[14rem_minmax(0,1fr)_7rem_auto]">
        <Select
          label="Valor substituído"
          value={value.target}
          options={STATS}
          onChange={(target) => onChange({ ...value, target: target as CustomNativeStatTarget })}
        />
        <TextInput
          label="Fórmula"
          value={value.formula}
          onChange={(formula) => onChange({ ...value, formula })}
        />
        <TextInput
          label="Prioridade"
          type="number"
          value={String(value.priority ?? 0)}
          onChange={(priority) => onChange({ ...value, priority: Number(priority) || 0 })}
        />
        <div className="flex items-end gap-2">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-xs text-textH">
            <input
              type="checkbox"
              checked={value.enabled !== false}
              onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
            />
            Ativa
          </label>
          <RemoveButton onClick={onRemove} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FormulaVariablePicker
          variables={listCustomFormulaVariables(definition)}
          onSelect={(path) =>
            onChange({ ...value, formula: `${value.formula}${value.formula.trim() ? " " : ""}${path}` })
          }
        />
        <span className={error ? "text-xs text-red-300" : "text-xs text-emerald-300"}>
          {error ?? "Fórmula válida."}
        </span>
      </div>
    </div>
  )
}

function ActionRow({ definition, value, onChange, onRemove }: {
  definition: CustomSystemDefinition
  value: CustomSystemActionDefinition
  onChange: (value: CustomSystemActionDefinition) => void
  onRemove: () => void
}) {
  const resources = value.resourceChanges ?? []
  const conditions = value.conditionChanges ?? []

  return (
    <div className="rounded-xl border border-border bg-bg-subtle p-4">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <TextInput label="Nome" value={value.name} onChange={(name) => onChange({ ...value, name })} />
        <TextInput label="ID" value={value.id} onChange={(id) => onChange({ ...value, id: slug(id) })} />
        <Select
          label="Categoria"
          value={value.actionKind}
          options={ACTIONS.filter(([kind]) => kind !== "")}
          onChange={(actionKind) => onChange({ ...value, actionKind: actionKind as AbilityActionKind })}
        />
        <div className="flex items-end gap-2">
          <label className="flex h-10 flex-1 items-center gap-2 rounded-lg border border-border px-3 text-xs text-textH">
            <input
              type="checkbox"
              checked={value.enabled !== false}
              onChange={(event) => onChange({ ...value, enabled: event.target.checked })}
            />
            Ativo
          </label>
          <RemoveButton onClick={onRemove} />
        </div>
      </div>
      <TextInput
        label="Descrição"
        value={value.description ?? ""}
        onChange={(description) => onChange({ ...value, description: description || undefined })}
      />

      <MiniSection
        title="Alterações de recurso"
        onAdd={() => onChange({ ...value, resourceChanges: [...resources, newResourceChange(definition)] })}
      >
        {resources.map((change, index) => (
          <ResourceRow
            key={change.id}
            definition={definition}
            value={change}
            onChange={(next) =>
              onChange({
                ...value,
                resourceChanges: resources.map((entry, current) => current === index ? next : entry),
              })
            }
            onRemove={() =>
              onChange({ ...value, resourceChanges: resources.filter((_, current) => current !== index) })
            }
          />
        ))}
        {!resources.length ? <Empty>Nenhum recurso alterado.</Empty> : null}
      </MiniSection>

      <MiniSection
        title="Condições / estados"
        onAdd={() => onChange({ ...value, conditionChanges: [...conditions, newCondition()] })}
      >
        {conditions.map((change, index) => (
          <ConditionRow
            key={change.id}
            value={change}
            onChange={(next) =>
              onChange({
                ...value,
                conditionChanges: conditions.map((entry, current) => current === index ? next : entry),
              })
            }
            onRemove={() =>
              onChange({ ...value, conditionChanges: conditions.filter((_, current) => current !== index) })
            }
          />
        ))}
        {!conditions.length ? <Empty>Nenhum estado alterado.</Empty> : null}
      </MiniSection>
    </div>
  )
}

function ResourceRow({ definition, value, onChange, onRemove }: {
  definition: CustomSystemDefinition
  value: CustomAbilityResourceChangeDefinition
  onChange: (value: CustomAbilityResourceChangeDefinition) => void
  onRemove: () => void
}) {
  const custom = value.target.source === "customSystem"
  const formulaError = value.formula?.trim()
    ? validateCustomFormula(value.formula, definition)
    : undefined

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Operação"
          value={value.operation}
          options={[["spend", "Gastar"], ["gain", "Gerar"], ["set", "Definir"]]}
          onChange={(operation) => onChange({ ...value, operation: operation as "spend" | "gain" | "set" })}
        />
        <Select
          label="Origem"
          value={value.target.source}
          options={[["native", "Ficha normal"], ["customSystem", "Este sistema"]]}
          onChange={(source) =>
            onChange({
              ...value,
              target: source === "native"
                ? { source: "native", resource: "hitPoints" }
                : { source: "customSystem", systemId: definition.id, resourceId: definition.resources[0]?.id ?? "" },
            })
          }
        />
        <Select
          label="Recurso"
          value={custom ? value.target.resourceId : value.target.resource}
          options={custom
            ? definition.resources.map((resource) => [resource.id, resource.name] as const)
            : NATIVE_RESOURCES}
          onChange={(resource) =>
            onChange({
              ...value,
              target: custom
                ? { source: "customSystem", systemId: definition.id, resourceId: resource }
                : { source: "native", resource: resource as "hitPoints" | "temporaryHitPoints" | "inspiration" | "exhaustion" },
            })
          }
        />
        <TextInput
          label="Quantidade"
          type="number"
          value={String(value.amount ?? 1)}
          onChange={(amount) => onChange({ ...value, amount: Number(amount) || 0 })}
        />
        <div className="flex items-end"><RemoveButton onClick={onRemove} /></div>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <TextInput
          label="Fórmula opcional da quantidade"
          value={value.formula ?? ""}
          onChange={(formula) => onChange({ ...value, formula: formula || undefined })}
        />
        <FormulaVariablePicker
          variables={listCustomFormulaVariables(definition)}
          onSelect={(path) => onChange({ ...value, formula: `${value.formula ?? ""}${value.formula?.trim() ? " " : ""}${path}` })}
        />
      </div>
      {formulaError ? <div className="mt-1 text-xs text-red-300">{formulaError}</div> : null}
    </div>
  )
}

function ConditionRow({ value, onChange, onRemove }: {
  value: CustomSystemConditionChangeDefinition
  onChange: (value: CustomSystemConditionChangeDefinition) => void
  onRemove: () => void
}) {
  const duration = value.duration ?? { type: "permanent" as const }
  const numeric = ["rounds", "turns", "minutes", "hours", "days"].includes(duration.type)

  return (
    <div className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-2 lg:grid-cols-5">
      <Select
        label="Operação"
        value={value.operation}
        options={[["add", "Aplicar / renovar"], ["remove", "Remover"]]}
        onChange={(operation) => onChange({ ...value, operation: operation as "add" | "remove" })}
      />
      <TextInput label="Estado" value={value.name} onChange={(name) => onChange({ ...value, name })} />
      {value.operation === "add" ? (
        <>
          <Select
            label="Duração"
            value={duration.type}
            options={DURATIONS}
            onChange={(type) => onChange({ ...value, duration: { ...duration, type: type as ConditionDurationType } })}
          />
          <TextInput
            label={numeric ? "Quantidade" : "Comportamento"}
            type={numeric ? "number" : "text"}
            value={numeric ? String(duration.amount ?? 1) : value.behavior ?? ""}
            onChange={(next) =>
              numeric
                ? onChange({ ...value, duration: { ...duration, amount: Math.max(0, Number(next) || 0) } })
                : onChange({ ...value, behavior: next || undefined })
            }
          />
        </>
      ) : <><div /><div /></>}
      <div className="flex items-end"><RemoveButton onClick={onRemove} /></div>
    </div>
  )
}

function Section({ title, description, action, children }: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-bg p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-textH">{title}</h2><p className="mt-1 text-sm leading-6 text-text">{description}</p></div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function MiniSection({ title, onAdd, children }: { title: string; onAdd: () => void; children: ReactNode }) {
  return (
    <section className="mt-4 rounded-xl border border-border bg-bg p-3">
      <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold text-textH">{title}</h3><AddButton label="Adicionar" onClick={onAdd} /></div>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  )
}

function TextInput({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="mt-2 grid gap-1 text-xs text-text">{label}<input className="input-base" type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}

function Select({ label, value, options, onChange }: { label: string; value: string | undefined; options: ReadonlyArray<readonly [string, string]>; onChange: (value: string) => void }) {
  return <label className="mt-2 grid gap-1 text-xs text-text">{label}<select className="input-base" value={value ?? ""} onChange={(event) => onChange(event.target.value)}>{options.map(([id, name]) => <option key={id || "none"} value={id}>{name}</option>)}</select></label>
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-textH hover:bg-accentBg"><Plus className="h-3.5 w-3.5" />{label}</button>
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return <button type="button" title="Remover" onClick={onClick} className="rounded-lg border border-border p-2 text-textMuted hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-textMuted">{children}</div>
}

function newOverride(existing: CustomNativeStatOverrideDefinition[]): CustomNativeStatOverrideDefinition {
  const used = new Set(existing.map((entry) => entry.target))
  const target = STATS.find(([candidate]) => !used.has(candidate))?.[0] ?? "initiative"
  return { id: `stat-${crypto.randomUUID()}`, target, formula: target === "initiative" ? "character.attributeModifier.dex" : "0", priority: 0, enabled: true }
}

function newAction(existing: CustomSystemActionDefinition[]): CustomSystemActionDefinition {
  return { id: `acao-${existing.length + 1}-${crypto.randomUUID().slice(0, 6)}`, name: `Nova ação ${existing.length + 1}`, actionKind: "action", enabled: true, resourceChanges: [], conditionChanges: [] }
}

function newResourceChange(definition: CustomSystemDefinition): CustomAbilityResourceChangeDefinition {
  return definition.resources.length
    ? { id: crypto.randomUUID(), target: { source: "customSystem", systemId: definition.id, resourceId: definition.resources[0].id }, operation: "spend", amount: 1 }
    : { id: crypto.randomUUID(), target: { source: "native", resource: "hitPoints" }, operation: "spend", amount: 1 }
}

function newCondition(): CustomSystemConditionChangeDefinition {
  return { id: crypto.randomUUID(), operation: "add", name: "Novo estado", duration: { type: "permanent" } }
}

function normalizeActionKind(value: unknown): AbilityActionKind | undefined {
  if (value === "freeAction") return "free"
  return ACTIONS.some(([kind]) => kind && kind === value) ? value as AbilityActionKind : undefined
}

function slug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
}
