from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Shared proficiency editor used by abilities and races.
# ---------------------------------------------------------------------------
old_editor = "src/features/characters/abilities/grantedProficienciesEditor.tsx"
new_editor = "src/features/characters/proficiencies/grantedProficienciesEditor.tsx"
editor = read(old_editor)
editor = replace_once(
    editor,
    '''export function GrantedProficienciesEditor({
  proficiencies,
  onChange,
}: {
  proficiencies: Proficiency[]
  onChange: (proficiencies: Proficiency[]) => void
}) {''',
    '''export function GrantedProficienciesEditor({
  proficiencies,
  onChange,
  title = "Proficiências concedidas",
  description =
    "Enquanto esta fonte estiver ativa, estas proficiências passam a fazer parte da ficha do personagem.",
  emptyMessage = "Nenhuma proficiência concedida.",
}: {
  proficiencies: Proficiency[]
  onChange: (proficiencies: Proficiency[]) => void
  title?: string
  description?: string
  emptyMessage?: string
}) {''',
    "shared editor props",
)
editor = replace_once(
    editor,
    '''        <div className="text-xs font-semibold text-textH">
          Proficiências concedidas
        </div>
        <p className="mt-1 text-[11px] leading-4 text-textMuted">
          Enquanto os modificadores desta habilidade estiverem ativos, estas
          proficiências passam a fazer parte da ficha do personagem.
        </p>''',
    '''        <div className="text-xs font-semibold text-textH">{title}</div>
        <p className="mt-1 text-[11px] leading-4 text-textMuted">
          {description}
        </p>''',
    "shared editor heading",
)
editor = replace_once(
    editor,
    "          Nenhuma proficiência concedida.",
    "          {emptyMessage}",
    "shared editor empty message",
)
write(new_editor, editor)
Path(old_editor).unlink()

path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    'import { GrantedProficienciesEditor } from "./grantedProficienciesEditor"',
    'import { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"',
    "ability shared editor import",
)
write(path, text)


# ---------------------------------------------------------------------------
# Race tab uses the exact same shared editor.
# ---------------------------------------------------------------------------
path = "src/features/characters/race/characterRaceV2.tsx"
text = read(path)
text = replace_once(
    text,
    'import { useEffect, useMemo, useState, type ReactNode } from "react"',
    'import { useEffect, useMemo, useState } from "react"',
    "race react import",
)
text = replace_once(
    text,
    'import { Check, Plus, Trash2, X } from "lucide-react"',
    'import { Check, Plus } from "lucide-react"',
    "race icon import",
)
text = text.replace('import { Textarea } from "../../../components/ui/Textarea"\n', '')
text = replace_once(
    text,
    '''import type {
  Proficiency,
  ProficiencyCategory,
} from "../../../models/sheet/Proficiency"''',
    'import type { Proficiency } from "../../../models/sheet/Proficiency"',
    "race proficiency import",
)
text = replace_once(
    text,
    'import { AbilityDialog } from "../abilities/abilityDialog"',
    'import { AbilityDialog } from "../abilities/abilityDialog"\nimport { GrantedProficienciesEditor } from "../proficiencies/grantedProficienciesEditor"',
    "race shared editor import",
)
text = re.sub(
    r'\nconst PROFICIENCY_CATEGORIES: Array<\{.*?\n\]\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
text = text.replace(
    '  const [proficiencyModalOpen, setProficiencyModalOpen] = useState(false)\n',
    '',
)

start = text.index("  function addProficiency(")
end = text.index("\n\n  return (", start)
replacement = '''  function setRaceProficiencies(proficiencies: Proficiency[]) {
    updateCharacter(character.get("id"), (current) => {
      const sheet = current.get("sheet")
      const skills = { ...sheet.skills }
      const savingThrowProficiencies = {
        ...sheet.savingThrowProficiencies,
      }

      for (const proficiency of proficiencies) {
        if (proficiency.category === "skill") {
          const skill = getSkillFromName(proficiency.name)
          if (skill && skills[skill] !== "expertise") {
            skills[skill] = "proficient"
          }
        }

        if (proficiency.category === "saving-throw") {
          const attribute = getAttributeFromName(proficiency.name)
          if (attribute) savingThrowProficiencies[attribute] = true
        }
      }

      return current.withPatch({
        sheet: {
          ...sheet,
          skills,
          savingThrowProficiencies,
          race: {
            ...sheet.race,
            proficiencies,
          },
        },
      })
    })
    setSelectedPresetId("custom")
  }'''
text = text[:start] + replacement + text[end:]

race_title = text.index("Proficiências raciais")
section_start = text.rfind('      <section className=', 0, race_title)
section_end = text.index('      </section>', race_title) + len('      </section>')
shared_section = '''      <GrantedProficienciesEditor
        proficiencies={race.proficiencies ?? []}
        onChange={setRaceProficiencies}
        title="Proficiências raciais"
        description="Inclui perícias, testes de resistência, conjuração com mãos ocupadas e outros treinamentos concedidos pela raça."
        emptyMessage="Nenhuma proficiência racial cadastrada."
      />'''
text = text[:section_start] + shared_section + text[section_end:]

text = re.sub(
    r'\n\s*<AddRaceProficiencyModal\n.*?\n\s*/>',
    '',
    text,
    count=1,
    flags=re.S,
)
if "function AddRaceProficiencyModal" in text:
    modal_start = text.index("function AddRaceProficiencyModal")
    modal_end = text.index("function EmptyCard", modal_start)
    text = text[:modal_start] + text[modal_end:]
text = re.sub(
    r'\nfunction formatProficiencyCategory\(.*?\n\}\n',
    '\n',
    text,
    count=1,
    flags=re.S,
)
write(path, text)


# ---------------------------------------------------------------------------
# Simplified sheet action reference.
# ---------------------------------------------------------------------------
actions_path = "src/features/characters/characterSheet/minimalCharacterActions.tsx"
actions = '''import { useMemo, useState } from "react"
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
'''
write(actions_path, actions)

path = "src/features/characters/characterSheet/minimalCharacterSheet.tsx"
text = read(path)
text = replace_once(
    text,
    'import { SelectSkillModule } from "./skills/selectCharacterSkills"',
    'import { SelectSkillModule } from "./skills/selectCharacterSkills"\nimport { MinimalCharacterActions } from "./minimalCharacterActions"',
    "minimal actions import",
)
marker = '''      <HandItemActionsDialog
        character={character}'''
index = text.rfind(marker)
if index < 0:
    raise SystemExit("minimal hand dialog marker not found")
text = (
    text[:index]
    + '''      <MinimalCharacterActions character={character} />\n\n'''
    + text[index:]
)
write(path, text)


checks = {
    new_editor: [
        "OCCUPIED_HANDS_SPELLCASTING_TYPE",
        "title = \"Proficiências concedidas\"",
    ],
    "src/features/characters/race/characterRaceV2.tsx": [
        "GrantedProficienciesEditor",
        "setRaceProficiencies",
    ],
    actions_path: [
        "Ações padrão",
        "Habilidades do personagem",
        "spellsList",
    ],
    "src/features/characters/characterSheet/minimalCharacterSheet.tsx": [
        "MinimalCharacterActions",
    ],
}
for filename, needles in checks.items():
    content = read(filename)
    for needle in needles:
        if needle not in content:
            raise SystemExit(f"{needle} missing from {filename}")
