import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import { normalizeAbilityText } from "../../../lib/textNormalization"
import type {
  Ability,
  AbilityActionKind,
  AbilityCategory,
  AbilityKind,
  Trigger,
  AbilityUsageCooldownUnit,
  AbilityUsageResetKind,
} from "../../../models/abilities/Ability"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_KIND_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"
import {
  GrantedSpellsEditor,
  type EditableSpellGrant,
} from "../magic/grantedSpellsEditor"

type Props = {
  open: boolean
  ability: Ability | null
  onClose: () => void
  onSave: (ability: Ability) => void
}

function createEmptyAbility(): Ability {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    kind: "active",
    category: "general",
    actionKind: "action",
    trigger: "always",
    grantedSpells: [],
  }
}

export function AbilityDialog({ open, ability, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Ability>(() =>
    ability ?? createEmptyAbility(),
  )

  useEffect(() => {
    if (open) setDraft(ability ?? createEmptyAbility())
  }, [open, ability])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null
  const hasUsage = draft.usage !== undefined

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-bg p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">
              {ability ? "Editar habilidade" : "Adicionar habilidade"}
            </h2>
            <p className="mt-1 text-xs text-textMuted">
              Configure categoria, comportamento, usos e magias concedidas.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onClose}>Fechar</Button>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Nome</span>
            <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Descrição</span>
            <Textarea className="min-h-24" value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>

          <div className="grid gap-2 md:grid-cols-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Categoria</span>
              <Select value={draft.category ?? "general"} onChange={(event) => setDraft({ ...draft, category: event.target.value as AbilityCategory })}>
                <option value="general">Habilidade</option>
                <option value="invocation">Evocação</option>
                <option value="feat">Talento</option>
              </Select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Tipo</span>
              <Select value={draft.kind ?? "active"} onChange={(event) => setDraft({ ...draft, kind: event.target.value as AbilityKind })}>
                {ABILITY_KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-textH">Ação</span>
              <Select value={draft.actionKind ?? "action"} disabled={draft.kind === "passive"} onChange={(event) => setDraft({ ...draft, actionKind: event.target.value as AbilityActionKind })}>
                {ABILITY_ACTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>
          </div>

          <label className="grid gap-1">
            <span className="text-xs font-medium text-textH">Gatilho</span>
            <Select value={draft.trigger ?? "always"} onChange={(event) => setDraft({ ...draft, trigger: event.target.value as Trigger })}>
              {ABILITY_TRIGGER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </label>

          <section className="rounded-xl border border-border bg-bg-subtle p-3">
            <label className="flex items-center gap-2 text-xs font-medium text-textH">
              <input type="checkbox" checked={hasUsage} onChange={(event) => setDraft({ ...draft, usage: event.target.checked ? { max: 1, used: 0, reset: "shortRest" } : undefined })} />
              Tem contador de usos
            </label>

            {hasUsage && draft.usage ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-xs text-textMuted">Máximo</span>
                  <Input type="number" min={1} value={draft.usage.max} onChange={(event) => {
                    const max = Math.max(1, Number(event.target.value) || 1)
                    setDraft({ ...draft, usage: { ...draft.usage!, max, used: Math.min(draft.usage!.used, max) } })
                  }} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-textMuted">Usado</span>
                  <Input type="number" min={0} value={draft.usage.used} onChange={(event) => setDraft({ ...draft, usage: { ...draft.usage!, used: Math.max(0, Math.min(draft.usage!.max, Number(event.target.value) || 0)) } })} />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-textMuted">Reset</span>
                  <Select value={draft.usage.reset} onChange={(event) => setDraft({ ...draft, usage: { ...draft.usage!, reset: event.target.value as AbilityUsageResetKind } })}>
                    {USAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                </label>
                {draft.usage.reset === "cooldown" ? (
                  <>
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Cooldown</span>
                      <Input type="number" min={1} value={draft.usage.cooldownAmount ?? 1} onChange={(event) => setDraft({ ...draft, usage: { ...draft.usage!, cooldownAmount: Math.max(1, Number(event.target.value) || 1) } })} />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs text-textMuted">Unidade</span>
                      <Select value={draft.usage.cooldownUnit ?? "turns"} onChange={(event) => setDraft({ ...draft, usage: { ...draft.usage!, cooldownUnit: event.target.value as AbilityUsageCooldownUnit } })}>
                        {COOLDOWN_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </Select>
                    </label>
                  </>
                ) : null}
              </div>
            ) : null}
          </section>

          <GrantedSpellsEditor variant="ability" grants={(draft.grantedSpells ?? []) as EditableSpellGrant[]} abilityHasUsage={hasUsage} onChange={(grantedSpells) => setDraft({ ...draft, grantedSpells })} />
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!draft.name.trim()} onClick={() => onSave(normalizeAbilityText(draft))}>Salvar</Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
