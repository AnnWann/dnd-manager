import {
  ArrowRightLeft,
  Bolt,
  Footprints,
  Hand,
  MessageCircle,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Swords,
} from "lucide-react"

import { Button } from "../../../../../../components/ui/Button"
import type { ActionType } from "../../../../../../models/actions/Actions"
import type { CharacterTemplate } from "../../../../../../models/characters/CharacterTemplate"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (c: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type ActionDefinition = {
  key: ActionType
  label: string
  shortLabel: string
  description: string
  icon: typeof Swords
}

const CORE_ACTIONS: ActionDefinition[] = [
  {
    key: "action",
    label: "Ação",
    shortLabel: "ações",
    description:
      "Atacar, conjurar uma magia, correr, desengajar, esquivar, ajudar, esconder-se ou preparar uma ação.",
    icon: Swords,
  },
  {
    key: "bonusAction",
    label: "Ação bônus",
    shortLabel: "ações bônus",
    description:
      "Só pode ser usada quando uma habilidade, magia ou característica conceder uma ação bônus.",
    icon: Bolt,
  },
  {
    key: "reaction",
    label: "Reação",
    shortLabel: "reações",
    description:
      "É usada fora do próprio turno quando um gatilho ocorre e retorna no início do próximo turno.",
    icon: ShieldAlert,
  },
  {
    key: "interaction",
    label: "Interação com objeto",
    shortLabel: "interações",
    description:
      "Sacar uma arma, abrir uma porta ou manipular um objeto simples durante o movimento ou a ação.",
    icon: Hand,
  },
]

const LEGENDARY_ACTIONS: ActionDefinition[] = [
  {
    key: "legendaryAction",
    label: "Ação lendária",
    shortLabel: "ações lendárias",
    description:
      "Recurso especial usado normalmente ao fim do turno de outra criatura.",
    icon: Sparkles,
  },
  {
    key: "legendaryReaction",
    label: "Reação lendária",
    shortLabel: "reações lendárias",
    description:
      "Reação especial adicional, usada apenas quando a criatura possuir essa regra.",
    icon: ArrowRightLeft,
  },
  {
    key: "legendaryResistance",
    label: "Resistência lendária",
    shortLabel: "resistências lendárias",
    description:
      "Permite transformar uma falha em teste de resistência em sucesso.",
    icon: ShieldAlert,
  },
]

const DEFAULT_PLAYER_ACTIONS: Partial<Record<ActionType, number>> = {
  action: 1,
  bonusAction: 1,
  reaction: 1,
  interaction: 1,
  free: 999,
  legendaryAction: 0,
  legendaryReaction: 0,
  legendaryResistance: 0,
}

export function GroupActions({
  character,
  updateCharacter,
}: Props) {
  const actions = character.get("actionsPerTurn")
  const isPlayerCharacter = character.get("sheet").type === "pc"
  const hasLegendaryResources = LEGENDARY_ACTIONS.some(
    ({ key }) => (actions[key] ?? 0) > 0,
  )

  function setAction(action: ActionType, value: number) {
    updateCharacter(character.get("id"), (current) =>
      current.withAction(action, Math.max(0, Math.min(99, Math.trunc(value)))),
    )
  }

  function resetDefaults() {
    updateCharacter(character.get("id"), (current) => {
      let next = current

      for (const [action, value] of Object.entries(DEFAULT_PLAYER_ACTIONS)) {
        next = next.withAction(action as ActionType, value ?? 0)
      }

      return next
    })
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-textH">
            Economia de ações
          </h2>
          <p className="mt-1 text-xs leading-5 text-textMuted">
            Estes valores representam o limite disponível em cada turno ou rodada,
            não quantas ações já foram gastas.
          </p>
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={resetDefaults}
          title="Restaurar a economia padrão de um personagem jogador"
        >
          <RotateCcw className="mr-1 h-4 w-4" />
          Restaurar padrão
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CORE_ACTIONS.map((definition) => (
          <ActionRuleCard
            key={definition.key}
            definition={definition}
            value={actions[definition.key] ?? 0}
            onChange={(value) => setAction(definition.key, value)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-2 rounded-xl border border-accentBorder bg-accentBg p-3 text-xs text-text sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <Footprints className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <div className="font-semibold text-textH">Deslocamento é separado</div>
            <p className="mt-0.5 leading-5 text-textMuted">
              O personagem pode dividir seu deslocamento antes e depois das ações.
              Correr usa a ação para conceder deslocamento adicional.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <div>
            <div className="font-semibold text-textH">Ações livres</div>
            <p className="mt-0.5 leading-5 text-textMuted">
              Fala breve, soltar um objeto e gestos simples não precisam de contador;
              situações complexas continuam a critério do mestre.
            </p>
          </div>
        </div>
      </div>

      {!isPlayerCharacter || hasLegendaryResources ? (
        <details className="mt-4 rounded-xl border border-border bg-bg-subtle">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-textH">
            Recursos lendários e especiais
          </summary>

          <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-2">
            {LEGENDARY_ACTIONS.map((definition) => (
              <ActionRuleCard
                key={definition.key}
                definition={definition}
                value={actions[definition.key] ?? 0}
                onChange={(value) => setAction(definition.key, value)}
                compact
              />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function ActionRuleCard({
  definition,
  value,
  onChange,
  compact = false,
}: {
  definition: ActionDefinition
  value: number
  onChange: (value: number) => void
  compact?: boolean
}) {
  const Icon = definition.icon

  return (
    <article className="rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accentBorder bg-accentBg text-accent">
            <Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-textH">
              {definition.label}
            </h3>
            {!compact ? (
              <p className="mt-1 text-[11px] leading-4 text-textMuted">
                {definition.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center rounded-lg border border-border bg-bg p-1">
          <button
            type="button"
            aria-label={`Reduzir ${definition.label}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-text transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
            disabled={value <= 0}
            onClick={() => onChange(value - 1)}
          >
            −
          </button>

          <div className="min-w-10 px-1 text-center">
            <div className="text-base font-bold leading-5 text-textH">
              {value}
            </div>
          </div>

          <button
            type="button"
            aria-label={`Aumentar ${definition.label}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold text-text transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-40"
            disabled={value >= 99}
            onClick={() => onChange(value + 1)}
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-textMuted">
        {value === 1
          ? `1 ${singularLabel(definition.key)} por turno`
          : `${value} ${definition.shortLabel} por turno`}
      </div>
    </article>
  )
}

function singularLabel(action: ActionType): string {
  if (action === "action") return "ação"
  if (action === "bonusAction") return "ação bônus"
  if (action === "reaction") return "reação"
  if (action === "interaction") return "interação"
  if (action === "legendaryAction") return "ação lendária"
  if (action === "legendaryReaction") return "reação lendária"
  if (action === "legendaryResistance") return "resistência lendária"
  return "ação livre"
}
