import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"

import { Modal } from "../../../components/ui/Modal"
import { cn } from "../../../lib/cn"
import type {
  Ability,
  AbilityActionKind,
} from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

type ActionFilter = "action" | "bonusAction" | "reaction"

type ActionEntry = {
  id: string
  name: string
  description: string
  filter: ActionFilter
  magic?: boolean
  source?: string
  ability?: Ability
}

const FILTER_OPTIONS: Array<{ value: ActionFilter; label: string }> = [
  { value: "action", label: "Ação" },
  { value: "bonusAction", label: "Ação bônus" },
  { value: "reaction", label: "Reação" },
]

const STANDARD_ACTIONS: ActionEntry[] = [
  {
    id: "attack",
    name: "Atacar",
    filter: "action",
    description:
      "Realize um ataque corpo a corpo ou à distância. Recursos como Ataque Extra podem permitir mais de um ataque dentro desta mesma ação.",
  },
  {
    id: "grapple-shove",
    name: "Agarrar ou empurrar",
    filter: "action",
    description:
      "Faça um ataque especial corpo a corpo para agarrar uma criatura ou empurrá-la. Quando possuir múltiplos ataques, normalmente substitui um deles.",
  },
  {
    id: "cast-action",
    name: "Conjurar magia",
    filter: "action",
    magic: true,
    description:
      "Conjure uma magia cujo tempo de conjuração seja uma ação, respeitando componentes, alcance, espaços de magia e demais requisitos.",
  },
  {
    id: "dash",
    name: "Correr",
    filter: "action",
    description:
      "Ganhe movimento adicional igual ao seu deslocamento atual durante este turno.",
  },
  {
    id: "disengage",
    name: "Desengajar",
    filter: "action",
    description:
      "Seu movimento não provoca ataques de oportunidade durante o restante do turno.",
  },
  {
    id: "dodge",
    name: "Esquivar",
    filter: "action",
    description:
      "Até o início do seu próximo turno, ataques visíveis contra você têm desvantagem e você tem vantagem em testes de resistência de Destreza, desde que possa agir e se mover.",
  },
  {
    id: "help",
    name: "Ajudar",
    filter: "action",
    description:
      "Ajude uma criatura em uma tarefa ou distraia um inimigo próximo, concedendo vantagem ao próximo teste ou ataque apropriado.",
  },
  {
    id: "hide",
    name: "Esconder-se",
    filter: "action",
    description:
      "Tente se ocultar realizando um teste de Furtividade quando o ambiente permitir que você não seja claramente visto.",
  },
  {
    id: "ready",
    name: "Preparar",
    filter: "action",
    description:
      "Defina um gatilho perceptível e uma ação para executar com sua reação. Preparar uma magia exige concentração até o gatilho ocorrer.",
  },
  {
    id: "search",
    name: "Procurar",
    filter: "action",
    description:
      "Procure algo usando um teste apropriado, normalmente Percepção ou Investigação, conforme o que está sendo analisado.",
  },
  {
    id: "use-object",
    name: "Usar objeto",
    filter: "action",
    description:
      "Use ou manipule um objeto que exija uma ação além da interação gratuita normalmente disponível no turno.",
  },
  {
    id: "light-weapon",
    name: "Ataque com arma leve",
    filter: "bonusAction",
    description:
      "Quando as regras de combate com duas armas forem atendidas, realize o ataque adicional permitido com uma arma leve empunhada.",
  },
  {
    id: "cast-bonus",
    name: "Conjurar magia de ação bônus",
    filter: "bonusAction",
    magic: true,
    description:
      "Conjure uma magia cujo tempo de conjuração seja uma ação bônus, observando as limitações de conjuração no mesmo turno.",
  },
  {
    id: "opportunity-attack",
    name: "Ataque de oportunidade",
    filter: "reaction",
    description:
      "Quando uma criatura visível deixa voluntariamente o seu alcance, use sua reação para realizar um ataque corpo a corpo contra ela.",
  },
  {
    id: "readied-reaction",
    name: "Executar ação preparada",
    filter: "reaction",
    description:
      "Quando o gatilho definido pela ação Preparar ocorrer, use sua reação para executar a resposta escolhida ou ignore o gatilho.",
  },
  {
    id: "cast-reaction",
    name: "Conjurar magia de reação",
    filter: "reaction",
    magic: true,
    description:
      "Conjure uma magia de reação quando o gatilho específico descrito nela acontecer.",
  },
]

export function MinimalCharacterActions({
  character,
}: {
  character: CharacterTemplate
}) {
  const navigate = useNavigate()
  const [filter, setFilter] = useState<ActionFilter>("action")
  const [selected, setSelected] = useState<ActionEntry | null>(null)
  const standardActions = STANDARD_ACTIONS.filter(
    (entry) => entry.filter === filter,
  )
  const abilityActions = useMemo(
    () => getAbilityActions(character, filter),
    [character, filter],
  )

  function open(entry: ActionEntry) {
    if (entry.magic) {
      navigate(
        `/character/${encodeURIComponent(character.get("id"))}/spellsList`,
      )
      return
    }
    setSelected(entry)
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-textH">
        Ações
      </h2>

      <div
        className="mt-2 grid grid-cols-3 gap-1 rounded-lg border border-border bg-bg-subtle p-1"
        role="tablist"
        aria-label="Filtrar ações"
      >
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

      <ActionGroup
        title="Ações padrão"
        entries={standardActions}
        onSelect={open}
      />

      <ActionGroup
        title="Habilidades do personagem"
        entries={abilityActions}
        onSelect={open}
        emptyMessage={`Nenhuma habilidade configurada como ${filterLabel(filter).toLocaleLowerCase("pt-BR")}.`}
      />

      {selected ? (
        <Modal
          title={selected.name}
          onClose={() => setSelected(null)}
          className="max-w-lg"
        >
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
              <span>{filterLabel(selected.filter)}</span>
              {selected.source ? <span>• {selected.source}</span> : null}
              {selected.ability?.usage ? (
                <span>
                  • {Math.max(0, selected.ability.usage.max - selected.ability.usage.used)}/
                  {selected.ability.usage.max} usos
                </span>
              ) : null}
            </div>
            <p className="whitespace-pre-wrap text-sm leading-6 text-text">
              {selected.description}
            </p>
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
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {title}
      </div>
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

function getAbilityActions(
  character: CharacterTemplate,
  filter: ActionFilter,
): ActionEntry[] {
  const raceAbilities = (
    character.get("sheet").race.naturalAbilities ?? []
  ).map((ability) => ({
    ...ability,
    id: `race:${ability.id}`,
    sourceLabel: "Raça",
  }))
  const characterAbilities = (character.getCharacterAbilities() ?? []).map(
    (ability) => ({
      ...ability,
      sourceLabel: ability.category === "feat" ? "Talento" : "Habilidade",
    }),
  )

  return [...characterAbilities, ...raceAbilities]
    .filter(
      (ability) =>
        (ability.kind ?? "active") === "active" &&
        normalizeActionKind(ability.actionKind) === filter,
    )
    .map((ability) => ({
      id: `ability:${ability.id}`,
      name: ability.name || "Habilidade sem nome",
      description:
        ability.description?.trim() ||
        "Esta habilidade não possui uma descrição cadastrada.",
      filter,
      source: ability.sourceLabel,
      ability,
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

function normalizeActionKind(
  actionKind: AbilityActionKind | undefined,
): ActionFilter | undefined {
  if (actionKind === "action") return "action"
  if (actionKind === "bonusAction") return "bonusAction"
  if (actionKind === "reaction") return "reaction"
  return undefined
}

function filterLabel(filter: ActionFilter): string {
  return FILTER_OPTIONS.find((option) => option.value === filter)?.label ?? filter
}
