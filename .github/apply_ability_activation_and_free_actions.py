from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


def replace_regex(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    updated, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f"{label} matched {count} times")
    return updated


# Ability model: explicit activation state and formula-backed maximum uses.
path = "src/models/abilities/Ability.ts"
text = read(path)
text = replace_once(
    text,
    '  /** Permite desativar modificadores sem remover a habilidade. Passivas permanecem ativas. */\n  modifiersActive?: boolean',
    '  /** Estado persistido dos benefícios de habilidades que precisam ser acionadas. */\n  benefitsActive?: boolean\n  /** Campo legado; novos cálculos usam benefitsActive. */\n  modifiersActive?: boolean',
    "ability activation field",
)
text = replace_once(
    text,
    'export interface Usage {\n  max: number',
    'export interface Usage {\n  max: number\n  /** Fórmula opcional; quando válida, substitui max nos cálculos. */\n  maxFormula?: string',
    "usage max formula",
)
write(path, text)


# Character ability state transitions.
path = "src/models/characters/characterAbilities.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Ability } from "../abilities/Ability"',
    '''import type { Ability } from "../abilities/Ability"
import {
  abilityRequiresActivation,
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  restoreAbilityUse,
} from "../abilities/abilityActivation"''',
    "character ability activation imports",
)
text = replace_regex(
    text,
    r'export function useAbility\(.*?\n\}\n\nexport function resetAbility',
    '''export function useAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId
        ? activateAbilityBenefits(character, ability)
        : ability,
    ),
  )
}

export function deactivateAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId
        ? deactivateAbilityBenefits(ability)
        : ability,
    ),
  )
}

export function resetAbility''',
    "character use/deactivate",
    re.S,
)
text = replace_once(
    text,
    '''        ...a,
        usage: {
          ...a.usage,
          used: 0,
          cooldownRemaining: undefined,
        },''',
    '''        ...a,
        benefitsActive: abilityRequiresActivation(a) ? false : undefined,
        modifiersActive: undefined,
        usage: {
          ...a.usage,
          used: 0,
          cooldownRemaining: undefined,
        },''',
    "reset deactivates benefits",
)
text = replace_regex(
    text,
    r'export function restoreAbility\(.*?\n\}',
    '''export function restoreAbility(
  character: CharacterTemplate,
  abilityId: string,
): CharacterTemplate {
  return character.with(
    "abilities",
    (character.get("abilities") ?? []).map((ability) =>
      ability.id === abilityId ? restoreAbilityUse(ability) : ability,
    ),
  )
}''',
    "restore ability helper",
    re.S,
)
write(path, text)


# Equipment abilities follow the same state machine.
path = "src/models/characters/characterEquipment.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Ability, Usage } from "../abilities/Ability"',
    '''import type { Ability, Usage } from "../abilities/Ability"
import {
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  restoreAbilityUse,
} from "../abilities/abilityActivation"''',
    "equipment ability activation imports",
)
text = replace_regex(
    text,
    r'export function useEquipmentAbility\(.*?\n\}\n\nexport function restoreEquipmentAbility',
    '''export function useEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) =>
      ability.id === abilityId
        ? activateAbilityBenefits(character, ability)
        : ability,
    ),
  }))
}

export function deactivateEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) =>
      ability.id === abilityId
        ? deactivateAbilityBenefits(ability)
        : ability,
    ),
  }))
}

export function restoreEquipmentAbility''',
    "equipment use/deactivate",
    re.S,
)
text = replace_regex(
    text,
    r'export function restoreEquipmentAbility\(.*?\n\}',
    '''export function restoreEquipmentAbility(
  character: CharacterTemplate,
  itemId: string,
  abilityId: string,
): CharacterTemplate {
  return updateEquipmentById(character, itemId, (equipment) => ({
    ...equipment,
    abilities: (equipment.abilities ?? []).map((ability) =>
      ability.id === abilityId ? restoreAbilityUse(ability) : ability,
    ),
  }))
}''',
    "equipment restore helper",
    re.S,
)
write(path, text)


# CharacterTemplate exposes deactivation methods.
path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '  resetAbility, \n  restoreAbility, ',
    '  resetAbility, \n  restoreAbility, \n  deactivateAbility, ',
    "template character deactivate import",
)
text = replace_once(
    text,
    '  restoreEquipmentAbility, \n  unequip,',
    '  restoreEquipmentAbility, \n  deactivateEquipmentAbility, \n  unequip,',
    "template equipment deactivate import",
)
text = replace_once(
    text,
    '  restoreAbility(abilityId: string): CharacterTemplate {return restoreAbility(this, abilityId)}\n  resetAbility',
    '  restoreAbility(abilityId: string): CharacterTemplate {return restoreAbility(this, abilityId)}\n  deactivateAbility(abilityId: string): CharacterTemplate {return deactivateAbility(this, abilityId)}\n  resetAbility',
    "template character deactivate method",
)
text = replace_once(
    text,
    '  restoreEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return restoreEquipmentAbility(this, itemId, abilityId)}',
    '  restoreEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return restoreEquipmentAbility(this, itemId, abilityId)}\n  deactivateEquipmentAbility(itemId: string, abilityId: string): CharacterTemplate {return deactivateEquipmentAbility(this, itemId, abilityId)}',
    "template equipment deactivate method",
)
write(path, text)


# Only activated abilities contribute bonuses.
path = "src/models/characters/characterStats.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Ability } from "../abilities/Ability"',
    'import type { Ability } from "../abilities/Ability"\nimport { isAbilityBenefitsActive } from "../abilities/abilityActivation"',
    "stats activation import",
)
text = replace_once(
    text,
    '''  ].filter(
    (ability) => ability.kind === "passive" || ability.modifiersActive !== false,
  )''',
    '''  ].filter(isAbilityBenefitsActive)''',
    "stats active ability filter",
)
write(path, text)


# Only activated abilities grant proficiencies.
path = "src/models/characters/characterProficiencies.ts"
text = read(path)
text = replace_once(
    text,
    'import { getEquippedItems } from "./characterEquipment"',
    'import { getEquippedItems } from "./characterEquipment"\nimport { isAbilityBenefitsActive } from "../abilities/abilityActivation"',
    "proficiency activation import",
)
text = replace_once(
    text,
    '''  ].filter(
    (ability) =>
      ability.kind === "passive" || ability.modifiersActive !== false,
  )''',
    '''  ].filter(isAbilityBenefitsActive)''',
    "proficiency active ability filter",
)
write(path, text)


# Granted spells are also benefits and respect activation.
path = "src/models/characters/characterGrantedSpells.ts"
text = read(path)
text = replace_once(
    text,
    'import type { Ability, Usage } from "../abilities/Ability"',
    'import type { Ability, Usage } from "../abilities/Ability"\nimport { isAbilityBenefitsActive } from "../abilities/abilityActivation"',
    "granted spell activation import",
)
text = replace_once(
    text,
    '''  for (const ability of character.get("abilities") ?? []) {
    addAbilitySpellGrants''',
    '''  for (const ability of character.get("abilities") ?? []) {
    if (!isAbilityBenefitsActive(ability)) continue
    addAbilitySpellGrants''',
    "character granted spell filter",
)
text = replace_once(
    text,
    '''  for (const ability of race.naturalAbilities ?? []) {
    addAbilitySpellGrants''',
    '''  for (const ability of race.naturalAbilities ?? []) {
    if (!isAbilityBenefitsActive(ability)) continue
    addAbilitySpellGrants''',
    "race granted spell filter",
)
text = replace_once(
    text,
    '''    for (const ability of equipment.abilities ?? []) {
      for (const grant''',
    '''    for (const ability of equipment.abilities ?? []) {
      if (!isAbilityBenefitsActive(ability)) continue
      for (const grant''',
    "equipment granted spell filter",
)
write(path, text)


# Ability editor: formula maximum and activation explanation.
path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    'import { normalizeAbilityText } from "../../../lib/textNormalization"',
    '''import { normalizeAbilityText } from "../../../lib/textNormalization"
import { validateCharacterSheetFormula } from "../../../lib/customSystems/CharacterSheetFormula"''',
    "ability dialog formula import",
)
text = replace_once(
    text,
    '} from "../../../models/abilities/Ability"',
    '''} from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  normalizeAbilityActivation,
} from "../../../models/abilities/abilityActivation"''',
    "ability dialog activation import",
)
text = replace_once(
    text,
    '    bonuses: {},\n    modifiersActive: true,',
    '    bonuses: {},\n    benefitsActive: false,',
    "empty ability inactive",
)
text = replace_once(
    text,
    '  const hasUsage = draft.usage !== undefined\n\n  return createPortal(',
    '''  const hasUsage = draft.usage !== undefined
  const maximumFormula = draft.usage?.maxFormula?.trim() ?? ""
  const maximumFormulaError = maximumFormula
    ? validateCharacterSheetFormula(maximumFormula)
    : undefined
  const requiresActivation = abilityRequiresActivation(draft)

  function updateUsageMaximum(rawValue: string) {
    if (!draft.usage) return
    const trimmed = rawValue.trim()
    const numeric = Number(trimmed)

    if (trimmed && Number.isFinite(numeric)) {
      const max = Math.max(1, Math.floor(numeric))
      setDraft({
        ...draft,
        usage: {
          ...draft.usage,
          max,
          maxFormula: undefined,
          used: Math.min(draft.usage.used, max),
        },
      })
      return
    }

    setDraft({
      ...draft,
      usage: {
        ...draft.usage,
        maxFormula: rawValue,
      },
    })
  }

  return createPortal(''',
    "ability dialog derived state",
)
text = replace_regex(
    text,
    r'''<label className="grid gap-1">\n\s*<span className="text-xs text-textMuted">Máximo</span>.*?</label>''',
    '''<label className="grid gap-1">
                  <span className="text-xs text-textMuted">
                    Máximo ou fórmula
                  </span>
                  <Input
                    type="text"
                    value={draft.usage.maxFormula ?? String(draft.usage.max)}
                    placeholder="Ex.: proficiencia ou 2 + nivel.total / 4"
                    onChange={(event) => updateUsageMaximum(event.target.value)}
                  />
                  {maximumFormulaError ? (
                    <span className="text-[10px] text-danger">
                      {maximumFormulaError}
                    </span>
                  ) : maximumFormula ? (
                    <span className="text-[10px] text-textMuted">
                      A fórmula é recalculada com os valores atuais da ficha.
                    </span>
                  ) : null}
                </label>''',
    "maximum formula field",
    re.S,
)
text = replace_regex(
    text,
    r'''\n\s*<label className="flex items-center gap-2 rounded-xl border border-border bg-bg-subtle p-3 text-xs font-medium text-textH">.*?</label>\n\n\s*<BonusesFields''',
    '''

          <div className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-5 text-text">
            {requiresActivation
              ? draft.kind === "passive"
                ? "Esta passiva possui um gatilho. Seus bônus, proficiências e magias só ficam ativos depois de Acionar."
                : "Habilidades ativas só aplicam seus bônus, proficiências e magias depois de Usar, mesmo sem contador de usos."
              : "Esta passiva não possui condição e concede seus benefícios permanentemente."}
          </div>

          <BonusesFields''',
    "activation explanation",
    re.S,
)
text = replace_once(
    text,
    '            disabled={!draft.name.trim()}\n            onClick={() => onSave(normalizeAbilityText(draft))}',
    '''            disabled={!draft.name.trim() || Boolean(maximumFormulaError)}
            onClick={() =>
              onSave(
                normalizeAbilityActivation(normalizeAbilityText(draft)),
              )
            }''',
    "ability save normalization",
)
write(path, text)


# Detailed ability card replacement.
write("src/features/characters/abilities/abilityCard.tsx", '''import { useState } from "react"

import { Button } from "../../../components/ui/Button"
import { useMagicContext } from "../../../contexts/magicContext"
import { cn } from "../../../lib/cn"
import type { Ability } from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  isAbilityBenefitsActive,
} from "../../../models/abilities/abilityActivation"
import { flattenBonuses } from "../inventory/equipmentBonusFields"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

type Props = {
  ability: Ability
  sourceLabel?: string
  usageMax?: number
  onEdit?: () => void
  onRemove?: () => void
  onUse?: () => void
  onDeactivate?: () => void
  onRestore?: () => void
}

function summaryLabel(ability: Ability) {
  const usage = ability.usage
  const kindLabel = ability.kind === "passive" ? "Passiva" : "Ativa"

  if (!usage) {
    return ability.kind === "passive"
      ? `${kindLabel} • ${ABILITY_TRIGGER_OPTIONS.find((option) => option.value === (ability.trigger ?? "always"))?.label ?? "Sempre"}`
      : `${kindLabel} • ${ABILITY_ACTION_OPTIONS.find((option) => option.value === (ability.actionKind ?? "action"))?.label ?? "Ação"}`
  }

  if (usage.reset === "cooldown") {
    const amount = Math.max(1, Math.trunc(usage.cooldownAmount ?? 1) || 1)
    const unit =
      COOLDOWN_UNIT_OPTIONS.find(
        (option) => option.value === (usage.cooldownUnit ?? "turns"),
      )?.label ?? "Turnos"

    return `${kindLabel} • Cooldown • ${amount} ${unit.toLowerCase()}`
  }

  return `${kindLabel} • ${USAGE_OPTIONS.find((option) => option.value === usage.reset)?.label ?? "Sem uso"}`
}

export function AbilityCard({
  ability,
  sourceLabel,
  usageMax,
  onEdit,
  onRemove,
  onUse,
  onDeactivate,
  onRestore,
}: Props) {
  const { getSpellByIndex } = useMagicContext()
  const [expanded, setExpanded] = useState(false)
  const usage = ability.usage
  const resolvedMax = usage ? Math.max(0, usageMax ?? usage.max) : null
  const remaining = usage && resolvedMax !== null
    ? Math.max(0, resolvedMax - usage.used)
    : null
  const description = ability.description?.trim() ?? ""
  const grantedSpells = (ability.grantedSpells ?? []).map((grant) => ({
    grant,
    spell: getSpellByIndex(grant.index),
  }))
  const bonusEntries = flattenBonuses(ability.bonuses ?? {})
  const requiresActivation = abilityRequiresActivation(ability)
  const benefitsActive = isAbilityBenefitsActive(ability)
  const canTrigger =
    requiresActivation &&
    Boolean(onUse) &&
    ((ability.kind ?? "active") === "active" || !benefitsActive)

  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-bg p-4 transition-shadow hover:shadow-theme",
        ability.kind === "passive" ? "border-dashed" : "",
        usage
          ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]"
          : "flex flex-col gap-4 md:flex-row md:items-center md:justify-between",
      )}
    >
      <div className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center gap-2">
          <div className="break-words text-sm font-semibold text-textH">
            {ability.name || "Habilidade sem nome"}
          </div>

          <span className="rounded-full border border-border bg-[color:color-mix(in_srgb,var(--social-bg)_70%,transparent)] px-2 py-0.5 text-[11px] font-medium text-text">
            {summaryLabel(ability)}
          </span>

          <span
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              benefitsActive
                ? "border-accentBorder bg-accentBg text-accent"
                : "border-border bg-bg-subtle text-textMuted",
            )}
          >
            {benefitsActive
              ? requiresActivation
                ? "Benefícios ativos"
                : "Sempre ativa"
              : "Aguardando acionamento"}
          </span>

          {sourceLabel ? (
            <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[11px] font-medium text-textH">
              {sourceLabel}
            </span>
          ) : null}
        </div>

        {description ? (
          <div className="mt-2 min-w-0">
            <p
              className={cn(
                "max-w-full whitespace-pre-wrap text-xs leading-5 text-text",
                "[overflow-wrap:anywhere] [word-break:break-word]",
                !expanded ? "line-clamp-3" : "",
              )}
            >
              {description}
            </p>

            {description.length > 120 ? (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-textH hover:opacity-80"
                onClick={() => setExpanded((current) => !current)}
              >
                {expanded ? "Ver menos" : "Ver mais"}
              </button>
            ) : null}
          </div>
        ) : null}

        {bonusEntries.length > 0 ? (
          <div className={cn("mt-3", !benefitsActive && "opacity-60")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Bônus concedidos
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {bonusEntries.map((entry) => (
                <span
                  key={entry.id}
                  className="rounded-full bg-accentBg px-2.5 py-1 text-[11px] font-medium text-textH"
                >
                  {entry.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {grantedSpells.length > 0 ? (
          <div className={cn("mt-3", !benefitsActive && "opacity-60")}>
            <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              Magias concedidas
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {grantedSpells.map(({ grant, spell }) => (
                <span
                  key={grant.index}
                  className="rounded-full bg-accentBg px-2.5 py-1 text-[11px] font-medium text-textH"
                >
                  {spell?.displayName || spell?.name || grant.index}
                  {grant.castingMode === "known"
                    ? " • espaços normais"
                    : " • pela habilidade"}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-2 text-xs text-text">
          {usage && resolvedMax !== null ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{remaining}/{resolvedMax} usos restantes</span>
              <span>Gastos {usage.used}</span>
              {usage.maxFormula ? <span>Máximo por fórmula</span> : null}
            </div>
          ) : (
            <span>Sem limite de usos.</span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:justify-end">
        {onEdit ? (
          <Button size="sm" variant="secondary" onClick={onEdit}>Editar</Button>
        ) : null}

        {canTrigger ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={remaining !== null && remaining <= 0}
            onClick={onUse}
          >
            {(ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}
          </Button>
        ) : null}

        {requiresActivation && benefitsActive && onDeactivate ? (
          <Button size="sm" variant="ghost" onClick={onDeactivate}>
            Encerrar efeito
          </Button>
        ) : null}

        {usage &&
        usage.reset !== "limited" &&
        usage.reset !== "spellSlot" &&
        onRestore ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={usage.used <= 0}
            onClick={onRestore}
          >
            Restaurar
          </Button>
        ) : null}

        {onRemove ? (
          <Button size="sm" variant="ghost" onClick={onRemove}>Remover</Button>
        ) : null}
      </div>
    </div>
  )
}
''')


# Compact ability card replacement.
write("src/features/characters/abilities/compactAbilityCard.tsx", '''import { useEffect, useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "../../../components/ui/Button"
import type { Ability } from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  isAbilityBenefitsActive,
} from "../../../models/abilities/abilityActivation"
import { AbilityCard } from "./abilityCard"

type Props = {
  ability: Ability
  sourceLabel?: string
  usageMax?: number
  onEdit?: () => void
  onRemove?: () => void
  onUse?: () => void
  onDeactivate?: () => void
  onRestore?: () => void
}

export function CompactAbilityCard({
  ability,
  sourceLabel,
  usageMax,
  onEdit,
  onRemove,
  onUse,
  onDeactivate,
  onRestore,
}: Props) {
  const [open, setOpen] = useState(false)
  const abilityName = ability.name || "Habilidade sem nome"
  const kindLabel = ability.kind === "passive" ? "Passiva" : "Ativa"
  const compactLabel = sourceLabel ? `${kindLabel} • ${sourceLabel}` : kindLabel
  const usage = ability.usage
  const resolvedMax = usage ? Math.max(0, usageMax ?? usage.max) : null
  const remaining = usage && resolvedMax !== null
    ? Math.max(0, resolvedMax - usage.used)
    : null
  const requiresActivation = abilityRequiresActivation(ability)
  const benefitsActive = isAbilityBenefitsActive(ability)
  const canUse =
    requiresActivation &&
    Boolean(onUse) &&
    ((ability.kind ?? "active") === "active" || !benefitsActive)
  const canRestore = Boolean(
    usage &&
      usage.reset !== "limited" &&
      usage.reset !== "spellSlot" &&
      onRestore,
  )

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [open])

  return (
    <>
      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 sm:flex sm:flex-nowrap">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-textH" title={abilityName}>
            {abilityName}
          </div>
          <span className="shrink-0 text-xs text-textMuted" aria-hidden="true">—</span>
          <div className="max-w-[32%] shrink-0 truncate whitespace-nowrap text-xs text-text" title={compactLabel}>
            {compactLabel}
          </div>
          <span className={benefitsActive ? "text-[10px] font-semibold text-accent" : "text-[10px] text-textMuted"}>
            {benefitsActive ? "Ativa" : "Inativa"}
          </span>
          {usage && resolvedMax !== null ? (
            <div className="shrink-0 whitespace-nowrap text-xs text-textMuted" title={`${remaining}/${resolvedMax} usos restantes`}>
              {remaining}/{resolvedMax}
            </div>
          ) : null}
        </div>

        {canUse || canRestore || (requiresActivation && benefitsActive && onDeactivate) ? (
          <div className="col-span-2 flex min-w-0 gap-2 sm:contents">
            {canUse ? (
              <Button
                className="min-w-0 flex-1 sm:flex-none sm:shrink-0"
                size="sm"
                variant="secondary"
                disabled={remaining !== null && remaining <= 0}
                onClick={onUse}
              >
                {(ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}
              </Button>
            ) : null}
            {requiresActivation && benefitsActive && onDeactivate ? (
              <Button className="min-w-0 flex-1 sm:flex-none" size="sm" variant="ghost" onClick={onDeactivate}>
                Encerrar
              </Button>
            ) : null}
            {canRestore ? (
              <Button
                className="min-w-0 flex-1 sm:flex-none sm:shrink-0"
                size="sm"
                variant="secondary"
                disabled={!usage || usage.used <= 0}
                onClick={onRestore}
              >
                Restaurar
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button className="shrink-0" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Visualizar
        </Button>
      </article>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Detalhes de ${abilityName}`}
              className="fixed inset-0 z-[12000] flex h-screen w-screen items-center justify-center bg-black/80 p-3 sm:p-4"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setOpen(false)
              }}
            >
              <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-xl sm:max-h-[calc(100dvh-2rem)]">
                <header className="flex shrink-0 items-start justify-between gap-3 border-b border-accentBorder bg-bg/95 p-4 backdrop-blur">
                  <div className="min-w-0">
                    <h2 className="truncate font-heading text-lg text-textH" title={abilityName}>{abilityName}</h2>
                    <div className="mt-1 truncate text-xs text-textMuted" title={compactLabel}>{compactLabel}</div>
                  </div>
                  <Button className="shrink-0" size="sm" variant="secondary" onClick={() => setOpen(false)}>Fechar</Button>
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
                  <AbilityCard
                    ability={ability}
                    sourceLabel={sourceLabel}
                    usageMax={usageMax}
                    onEdit={onEdit ? () => { setOpen(false); onEdit() } : undefined}
                    onRemove={onRemove ? () => { setOpen(false); onRemove() } : undefined}
                    onUse={onUse}
                    onDeactivate={onDeactivate}
                    onRestore={onRestore}
                  />
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
''')


# Character abilities tab: resolved formulas and activation/deactivation.
path = "src/features/characters/abilities/characterAbilities.tsx"
text = read(path)
text = replace_once(
    text,
    'import type { Ability } from "../../../models/abilities/Ability"',
    '''import type { Ability } from "../../../models/abilities/Ability"
import {
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  getAbilityUsageMax,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"''',
    "character tab activation imports",
)
text = replace_once(
    text,
    '''  function restoreAbility(id: string) {''',
    '''  function deactivateAbility(id: string) {
    updateCharacter(character.get("id"), (current) => {
      const ability = abilities.find((entry) => entry.id === id)
      if (!ability) return current

      if (isEquipmentAbility(ability)) {
        return current.deactivateEquipmentAbility(
          ability.sourceItemId,
          ability.originalAbilityId,
        )
      }

      if (isRaceAbility(ability)) {
        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "deactivate",
        )
      }

      return current.deactivateAbility(id)
    })
  }

  function restoreAbility(id: string) {''',
    "character tab deactivate function",
)
text = replace_once(
    text,
    '''                 const sourceLabel = getAbilitySourceLabel(''',
    '''                 const usageMax = ability.usage
                   ? getAbilityUsageMax(character, ability.usage)
                   : undefined
                 const sourceLabel = getAbilitySourceLabel(''',
    "character tab resolved maximum",
)
text = text.replace(
    '''                       sourceLabel={sourceLabel}
                       onEdit={editAbility}''',
    '''                       sourceLabel={sourceLabel}
                       usageMax={usageMax}
                       onEdit={editAbility}''',
)
text = text.replace(
    '''                       onUse={() => useAbility(ability.id)}
                       onRestore={() => restoreAbility(ability.id)}''',
    '''                       onUse={() => useAbility(ability.id)}
                       onDeactivate={() => deactivateAbility(ability.id)}
                       onRestore={() => restoreAbility(ability.id)}''',
)
text = text.replace(
    '''                     sourceLabel={sourceLabel}
                     onEdit={editAbility}''',
    '''                     sourceLabel={sourceLabel}
                     usageMax={usageMax}
                     onEdit={editAbility}''',
)
text = text.replace(
    '''                     onUse={() => useAbility(ability.id)}
                     onRestore={() => restoreAbility(ability.id)}''',
    '''                     onUse={() => useAbility(ability.id)}
                     onDeactivate={() => deactivateAbility(ability.id)}
                     onRestore={() => restoreAbility(ability.id)}''',
)
text = replace_regex(
    text,
    r'function updateRaceAbilityUsage\(.*?\n\}',
    '''function updateRaceAbilityState(
  character: CharacterTemplate,
  abilityId: string,
  action: "use" | "restore" | "deactivate",
): CharacterTemplate {
  const race = character.get("sheet").race

  return character.withSheet("race", {
    ...race,
    naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
      if (ability.id !== abilityId) return ability
      if (action === "use") return activateAbilityBenefits(character, ability)
      if (action === "restore") return restoreAbilityUse(ability)
      return deactivateAbilityBenefits(ability)
    }),
  })
}''',
    "character tab race state helper",
    re.S,
)
text = text.replace(
    '''        return updateRaceAbilityUsage(
          current,
          ability.originalAbilityId,
          1,
        )''',
    '''        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "use",
        )''',
)
text = text.replace(
    '''        return updateRaceAbilityUsage(
          current,
          ability.originalAbilityId,
          -1,
        )''',
    '''        return updateRaceAbilityState(
          current,
          ability.originalAbilityId,
          "restore",
        )''',
)
write(path, text)


# Race editors use the same state rules and formula maximums.
for path in [
    "src/features/characters/race/characterRaceV2.tsx",
    "src/features/characters/race/characterRace.tsx",
]:
    text = read(path)
    text = replace_once(
        text,
        'import type { Ability } from "../../../models/abilities/Ability"',
        '''import type { Ability } from "../../../models/abilities/Ability"
import {
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  getAbilityUsageMax,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"''',
        f"{path} activation imports",
    )
    text = replace_regex(
        text,
        r'  function updateAbilityUsage\(.*?\n  \}',
        '''  function updateAbilityState(
    abilityId: string,
    action: "use" | "restore" | "deactivate",
  ) {
    updateCharacter(character.get("id"), (current) => {
      const currentRace = current.get("sheet").race
      return current.withSheet("race", {
        ...currentRace,
        naturalAbilities: (currentRace.naturalAbilities ?? []).map((ability) => {
          if (ability.id !== abilityId) return ability
          if (action === "use") return activateAbilityBenefits(current, ability)
          if (action === "restore") return restoreAbilityUse(ability)
          return deactivateAbilityBenefits(ability)
        }),
      })
    })
  }''',
        f"{path} state function",
        re.S,
    )
    text = text.replace(
        '''                  sourceLabel="Raça"
                  onEdit''',
        '''                  sourceLabel="Raça"
                  usageMax={
                    ability.usage
                      ? getAbilityUsageMax(character, ability.usage)
                      : undefined
                  }
                  onEdit''',
    )
    text = text.replace(
        'onUse={() => updateAbilityUsage(ability.id, 1)}',
        'onUse={() => updateAbilityState(ability.id, "use")}',
    )
    text = text.replace(
        'onRestore={() => updateAbilityUsage(ability.id, -1)}',
        'onRestore={() => updateAbilityState(ability.id, "restore")}\n                  onDeactivate={() => updateAbilityState(ability.id, "deactivate")}',
    )
    write(path, text)


# Equipment feature list can activate, end and restore formula-backed abilities.
path = "src/features/characters/equipment/equipmentFeaturesList.tsx"
text = read(path)
text = replace_once(
    text,
    'import { useMagicContext } from "../../../contexts/magicContext"',
    '''import { useMagicContext } from "../../../contexts/magicContext"
import { useCharacterContext } from "../../../contexts/characterContext"
import {
  abilityRequiresActivation,
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
  restoreAbilityUse,
} from "../../../models/abilities/abilityActivation"''',
    "equipment feature activation imports",
)
text = replace_once(
    text,
    'type Props<T extends Equipment> = {\n  equipment: T',
    'type Props<T extends Equipment> = {\n  characterId: string\n  equipment: T',
    "equipment feature character id prop",
)
text = replace_once(
    text,
    'export function EquipmentFeaturesList<T extends Equipment>({\n  equipment,',
    'export function EquipmentFeaturesList<T extends Equipment>({\n  characterId,\n  equipment,',
    "equipment feature character id destructure",
)
text = replace_once(
    text,
    '  const { getSpellByIndex } = useMagicContext()\n  const abilities',
    '''  const { getSpellByIndex } = useMagicContext()
  const { activeCharacter, visibleCharacters } = useCharacterContext()
  const character =
    activeCharacter?.get("id") === characterId
      ? activeCharacter
      : visibleCharacters.find((entry) => entry.get("id") === characterId)
  const abilities''',
    "equipment feature character resolution",
)
text = replace_regex(
    text,
    r'  function updateAbilityCharge\(.*?\n  \}',
    '''  function updateAbilityState(
    abilityId: string,
    action: "use" | "restore" | "deactivate",
  ) {
    onUpdate((current) => ({
      ...current,
      abilities: (current.abilities ?? []).map((ability) => {
        if (ability.id !== abilityId) return ability
        if (action === "deactivate") return deactivateAbilityBenefits(ability)
        if (action === "restore") return restoreAbilityUse(ability)
        return character ? activateAbilityBenefits(character, ability) : ability
      }),
    }))
  }''',
    "equipment feature ability state function",
    re.S,
)
text = replace_once(
    text,
    '''          const usage = ability.usage
          const canConsume = usage && usage.reset !== "spellSlot"
          const canRestore =
            usage &&
            usage.reset !== "spellSlot" &&
            usage.reset !== "limited"
          const remaining = usage
            ? Math.max(0, usage.max - usage.used)
            : undefined''',
    '''          const usage = ability.usage
          const usageMax = usage
            ? character
              ? getAbilityUsageMax(character, usage)
              : usage.max
            : undefined
          const remaining = usage && usageMax !== undefined
            ? Math.max(0, usageMax - usage.used)
            : undefined
          const requiresActivation = abilityRequiresActivation(ability)
          const benefitsActive = isAbilityBenefitsActive(ability)
          const canTrigger =
            requiresActivation &&
            ((ability.kind ?? "active") === "active" || !benefitsActive)
          const canRestore =
            usage &&
            usage.reset !== "spellSlot" &&
            usage.reset !== "limited"''',
    "equipment feature ability derived state",
)
text = text.replace('${remaining}/${usage.max} cargas disponíveis', '${remaining}/${usageMax} cargas disponíveis')
text = replace_regex(
    text,
    r'''\{canConsume \? \(.*?\) : null\}\n\n\s*\{canRestore \? \(''',
    '''{canTrigger ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={remaining !== undefined && remaining <= 0}
                      onClick={() => updateAbilityState(ability.id, "use")}
                    >
                      {(ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}
                    </Button>
                  ) : null}

                  {requiresActivation && benefitsActive ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => updateAbilityState(ability.id, "deactivate")}
                    >
                      Encerrar
                    </Button>
                  ) : null}

                  {canRestore ? (''',
    "equipment feature activation buttons",
    re.S,
)
text = text.replace('onClick={() => updateAbilityCharge(ability.id, -1)}', 'onClick={() => updateAbilityState(ability.id, "restore")}')
write(path, text)


# Pass character id to the shared equipment feature list.
path = "src/features/characters/equipment/equipmentItemCard.tsx"
text = read(path)
text = replace_once(
    text,
    '<EquipmentFeaturesList equipment={item} onUpdate={onUpdate} />',
    '<EquipmentFeaturesList characterId={characterId} equipment={item} onUpdate={onUpdate} />',
    "equipment item feature character id",
)
write(path, text)

path = "src/features/characters/equipment/EquipmentWeaponsSection.tsx"
text = read(path)
text = replace_once(
    text,
    '''                  <EquipmentFeaturesList
                    equipment={weapon}''',
    '''                  <EquipmentFeaturesList
                    characterId={character.get("id")}
                    equipment={weapon}''',
    "weapon feature character id",
)
write(path, text)


# Free actions and ability activation from the simplified action list.
write("src/features/characters/characterSheet/minimalCharacterActions.tsx", '''import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Modal } from "../../../components/ui/Modal"
import { cn } from "../../../lib/cn"
import type {
  Ability,
  AbilityActionKind,
} from "../../../models/abilities/Ability"
import {
  abilityRequiresActivation,
  getAbilityUsageMax,
  isAbilityBenefitsActive,
} from "../../../models/abilities/abilityActivation"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

type ActionFilter = "action" | "bonusAction" | "reaction" | "free"

type AbilitySource =
  | { type: "character"; abilityId: string }
  | { type: "race"; abilityId: string }
  | { type: "equipment"; itemId: string; abilityId: string }

type ActionEntry = {
  id: string
  name: string
  description: string
  filter: ActionFilter
  magic?: boolean
  source?: string
  ability?: Ability
  abilitySource?: AbilitySource
}

const FILTER_OPTIONS: Array<{ value: ActionFilter; label: string }> = [
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
  { value: "free", label: "Ação livre" },
]

const STANDARD_ACTIONS: ActionEntry[] = [
  { id: "attack", name: "Atacar", filter: "action", description: "Realize um ataque corpo a corpo ou à distância. Recursos como Ataque Extra podem permitir mais de um ataque dentro desta mesma ação." },
  { id: "grapple-shove", name: "Agarrar ou empurrar", filter: "action", description: "Faça um ataque especial corpo a corpo para agarrar uma criatura ou empurrá-la. Quando possuir múltiplos ataques, normalmente substitui um deles." },
  { id: "cast-action", name: "Conjurar magia", filter: "action", magic: true, description: "Conjure uma magia cujo tempo de conjuração seja uma ação, respeitando componentes, alcance, espaços de magia e demais requisitos." },
  { id: "dash", name: "Correr", filter: "action", description: "Ganhe movimento adicional igual ao seu deslocamento atual durante este turno." },
  { id: "disengage", name: "Desengajar", filter: "action", description: "Seu movimento não provoca ataques de oportunidade durante o restante do turno." },
  { id: "dodge", name: "Esquivar", filter: "action", description: "Até o início do seu próximo turno, ataques visíveis contra você têm desvantagem e você tem vantagem em testes de resistência de Destreza, desde que possa agir e se mover." },
  { id: "help", name: "Ajudar", filter: "action", description: "Ajude uma criatura em uma tarefa ou distraia um inimigo próximo, concedendo vantagem ao próximo teste ou ataque apropriado." },
  { id: "hide", name: "Esconder-se", filter: "action", description: "Tente se ocultar realizando um teste de Furtividade quando o ambiente permitir que você não seja claramente visto." },
  { id: "ready", name: "Preparar", filter: "action", description: "Defina um gatilho perceptível e uma ação para executar com sua reação. Preparar uma magia exige concentração até o gatilho ocorrer." },
  { id: "search", name: "Procurar", filter: "action", description: "Procure algo usando um teste apropriado, normalmente Percepção ou Investigação, conforme o que está sendo analisado." },
  { id: "use-object", name: "Usar objeto", filter: "action", description: "Use ou manipule um objeto que exija uma ação além da interação gratuita normalmente disponível no turno." },
  { id: "light-weapon", name: "Ataque com arma leve", filter: "bonusAction", description: "Quando as regras de combate com duas armas forem atendidas, realize o ataque adicional permitido com uma arma leve empunhada." },
  { id: "cast-bonus", name: "Conjurar magia de ação bônus", filter: "bonusAction", magic: true, description: "Conjure uma magia cujo tempo de conjuração seja uma ação bônus, observando as limitações de conjuração no mesmo turno." },
  { id: "opportunity-attack", name: "Ataque de oportunidade", filter: "reaction", description: "Quando uma criatura visível deixa voluntariamente o seu alcance, use sua reação para realizar um ataque corpo a corpo contra ela." },
  { id: "readied-reaction", name: "Executar ação preparada", filter: "reaction", description: "Quando o gatilho definido pela ação Preparar ocorrer, use sua reação para executar a resposta escolhida ou ignore o gatilho." },
  { id: "cast-reaction", name: "Conjurar magia de reação", filter: "reaction", magic: true, description: "Conjure uma magia de reação quando o gatilho específico descrito nela acontecer." },
  { id: "interact-object", name: "Interagir com objeto", filter: "free", description: "Realize uma interação simples durante seu turno, como abrir uma porta destrancada, sacar uma arma ou pegar um objeto acessível. Interações adicionais podem exigir a ação Usar objeto." },
  { id: "speak", name: "Falar brevemente", filter: "free", description: "Comunique uma frase curta ou sinais simples durante seu turno, desde que a situação permita." },
  { id: "drop-item", name: "Soltar item", filter: "free", description: "Solte voluntariamente um item que esteja segurando. O item passa para o Inventário do chão quando esse fluxo for usado na ficha." },
  { id: "end-concentration", name: "Encerrar concentração", filter: "free", description: "Encerre voluntariamente a concentração em uma magia ou efeito a qualquer momento, sem gastar ação." },
]

export function MinimalCharacterActions({
  character,
  updateCharacter,
}: {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ActionFilter>("action")
  const [selected, setSelected] = useState<ActionEntry | null>(null)
  const standardActions = STANDARD_ACTIONS.filter((entry) => entry.filter === filter)
  const abilityActions = useMemo(
    () => getAbilityActions(character, filter),
    [character, filter],
  )

  function open(entry: ActionEntry) {
    if (entry.magic) {
      navigate(`/character/${encodeURIComponent(character.get("id"))}/spellsList`)
      return
    }
    setSelected(entry)
  }

  function changeAbilityState(entry: ActionEntry, action: "use" | "deactivate") {
    if (!entry.abilitySource) return
    updateCharacter(character.get("id"), (current) => {
      const source = entry.abilitySource!
      if (source.type === "equipment") {
        return action === "use"
          ? current.useEquipmentAbility(source.itemId, source.abilityId)
          : current.deactivateEquipmentAbility(source.itemId, source.abilityId)
      }
      if (source.type === "race") {
        const race = current.get("sheet").race
        return current.withSheet("race", {
          ...race,
          naturalAbilities: (race.naturalAbilities ?? []).map((ability) => {
            if (ability.id !== source.abilityId) return ability
            if (action === "use") {
              const { activateAbilityBenefits } = requireActivationHelpers()
              return activateAbilityBenefits(current, ability)
            }
            const { deactivateAbilityBenefits } = requireActivationHelpers()
            return deactivateAbilityBenefits(ability)
          }),
        })
      }
      return action === "use"
        ? current.useAbility(source.abilityId)
        : current.deactivateAbility(source.abilityId)
    })
    setSelected(null)
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-textH">Ações</h2>

      <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-bg-subtle p-1 sm:grid-cols-4" role="tablist" aria-label="Filtrar ações">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "rounded-md px-2 py-2 text-xs font-semibold transition-colors",
              filter === option.value
                ? "bg-accentBg text-textH shadow-theme-sm"
                : "text-textMuted hover:bg-bg hover:text-textH",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <ActionGroup title="Ações padrão" entries={standardActions} onSelect={open} />
      <ActionGroup
        title="Habilidades do personagem"
        entries={abilityActions}
        onSelect={open}
        emptyMessage={`Nenhuma habilidade configurada como ${filterLabel(filter).toLocaleLowerCase("pt-BR")}.`}
      />

      {selected ? (
        <Modal title={selected.name} onClose={() => setSelected(null)} className="max-w-lg">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              <span>{filterLabel(selected.filter)}</span>
              {selected.source ? <span>• {selected.source}</span> : null}
              {selected.ability?.usage ? (
                <span>
                  • {Math.max(0, getAbilityUsageMax(character, selected.ability.usage) - selected.ability.usage.used)}/
                  {getAbilityUsageMax(character, selected.ability.usage)} usos
                </span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">{selected.description}</p>
            {selected.ability && abilityRequiresActivation(selected.ability) ? (
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                {isAbilityBenefitsActive(selected.ability) ? (
                  <Button variant="ghost" onClick={() => changeAbilityState(selected, "deactivate")}>
                    Encerrar efeito
                  </Button>
                ) : null}
                {((selected.ability.kind ?? "active") === "active" || !isAbilityBenefitsActive(selected.ability)) ? (
                  <Button variant="primary" onClick={() => changeAbilityState(selected, "use")}>
                    {(selected.ability.kind ?? "active") === "passive" ? "Acionar" : "Usar"}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </section>
  )
}

function ActionGroup({
  title,
  entries,
  onSelect,
  emptyMessage,
}: {
  title: string
  entries: ActionEntry[]
  onSelect: (entry: ActionEntry) => void
  emptyMessage?: string
}) {
  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">{title}</div>
      {entries.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="min-h-14 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-left text-xs font-semibold leading-4 text-textH transition-colors hover:border-accentBorder hover:bg-accentBg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {entry.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-bg-subtle px-3 py-3 text-xs text-textMuted">
          {emptyMessage ?? "Nenhuma ação disponível."}
        </p>
      )}
    </div>
  )
}

function getAbilityActions(character: CharacterTemplate, filter: ActionFilter): ActionEntry[] {
  const raceAbilities = (character.get("sheet").race.naturalAbilities ?? []).map((ability) => ({
    ability,
    sourceLabel: "Raça",
    source: { type: "race", abilityId: ability.id } as AbilitySource,
  }))
  const characterAbilities = (character.getCharacterAbilities() ?? []).map((ability) => {
    if ("source" in ability && ability.source === "equipment") {
      return {
        ability,
        sourceLabel: `Equipamento: ${ability.sourceItemName}`,
        source: {
          type: "equipment",
          itemId: ability.sourceItemId,
          abilityId: ability.originalAbilityId,
        } as AbilitySource,
      }
    }
    return {
      ability,
      sourceLabel: ability.category === "feat" ? "Talento" : "Habilidade",
      source: { type: "character", abilityId: ability.id } as AbilitySource,
    }
  })

  return [...characterAbilities, ...raceAbilities]
    .filter(({ ability }) =>
      (ability.kind ?? "active") === "active" &&
      normalizeActionKind(ability.actionKind) === filter,
    )
    .map(({ ability, sourceLabel, source }) => ({
      id: `ability:${source.type}:${ability.id}`,
      name: ability.name || "Habilidade sem nome",
      description: ability.description?.trim() || "Esta habilidade não possui uma descrição cadastrada.",
      filter,
      source: sourceLabel,
      ability,
      abilitySource: source,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

function normalizeActionKind(actionKind: AbilityActionKind | undefined): ActionFilter | undefined {
  if (actionKind === "action") return "action"
  if (actionKind === "bonusAction") return "bonusAction"
  if (actionKind === "reaction") return "reaction"
  if (actionKind === "free") return "free"
  return undefined
}

function filterLabel(filter: ActionFilter): string {
  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter
}

function requireActivationHelpers() {
  return {
    activateAbilityBenefits: require("../../../models/abilities/abilityActivation").activateAbilityBenefits as typeof import("../../../models/abilities/abilityActivation").activateAbilityBenefits,
    deactivateAbilityBenefits: require("../../../models/abilities/abilityActivation").deactivateAbilityBenefits as typeof import("../../../models/abilities/abilityActivation").deactivateAbilityBenefits,
  }
}
''')

# Replace the dynamic require with static imports for Vite/TypeScript.
path = "src/features/characters/characterSheet/minimalCharacterActions.tsx"
text = read(path)
text = replace_once(
    text,
    '''  abilityRequiresActivation,
  getAbilityUsageMax,
  isAbilityBenefitsActive,''',
    '''  abilityRequiresActivation,
  activateAbilityBenefits,
  deactivateAbilityBenefits,
  getAbilityUsageMax,
  isAbilityBenefitsActive,''',
    "minimal action static helper imports",
)
text = text.replace(
    '''              const { activateAbilityBenefits } = requireActivationHelpers()
              return activateAbilityBenefits(current, ability)''',
    '''              return activateAbilityBenefits(current, ability)''',
)
text = text.replace(
    '''            const { deactivateAbilityBenefits } = requireActivationHelpers()
            return deactivateAbilityBenefits(ability)''',
    '''            return deactivateAbilityBenefits(ability)''',
)
text = replace_regex(
    text,
    r'\nfunction requireActivationHelpers\(\) \{.*?\n\}',
    '',
    "remove dynamic helper loader",
    re.S,
)
write(path, text)

path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    '<MinimalCharacterActions character={character} />',
    '<MinimalCharacterActions character={character} updateCharacter={updateCharacter} />',
    "minimal actions update callback",
)
write(path, text)


# Sanity checks.
checks = {
    "src/models/abilities/Ability.ts": ["benefitsActive", "maxFormula"],
    "src/models/abilities/abilityActivation.ts": ["getAbilityUsageMax", "activateAbilityBenefits"],
    "src/models/characters/characterStats.ts": ["isAbilityBenefitsActive"],
    "src/models/characters/characterProficiencies.ts": ["isAbilityBenefitsActive"],
    "src/models/characters/characterGrantedSpells.ts": ["isAbilityBenefitsActive"],
    "src/features/characters/abilities/abilityDialog.tsx": ["Máximo ou fórmula", "normalizeAbilityActivation"],
    "src/features/characters/abilities/abilityCard.tsx": ["Encerrar efeito", "usageMax"],
    "src/features/characters/characterSheet/minimalCharacterActions.tsx": ["Ação livre", "end-concentration"],
}
for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
