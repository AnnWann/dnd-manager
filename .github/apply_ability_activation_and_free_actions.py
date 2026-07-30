from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text()


def write(path: str, content: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f"{label} not found")
    return text.replace(old, new, 1)


# Persisted magic resource.
path = "src/models/magic/Magic.ts"
text = read(path)
text = replace_once(
    text,
    'export interface Magic {\n  spells: CharacterSpells\n  metamagic?: CharacterMetamagics\n}',
    '''export type ChannelDivinityResource = {
  used: number
}

export interface Magic {
  spells: CharacterSpells
  metamagic?: CharacterMetamagics
  channelDivinity?: ChannelDivinityResource
}''',
    "magic channel divinity resource",
)
write(path, text)


# Derived Channel Divinity rules and state transitions.
write(
    "src/models/characters/characterChannelDivinity.ts",
    '''import type { CharacterTemplate } from "./CharacterTemplate"

export type ChannelDivinityPool = {
  max: number
  current: number
  used: number
}

export function getChannelDivinityMax(
  character: CharacterTemplate,
): number {
  const clericLevel = character.getClassLevel("cleric")
  const paladinLevel = character.getClassLevel("paladin")

  const clericUses =
    clericLevel >= 18
      ? 3
      : clericLevel >= 6
        ? 2
        : clericLevel >= 2
          ? 1
          : 0
  const paladinUses = paladinLevel >= 3 ? 1 : 0

  // Multiclassing grants additional Channel Divinity options, not additive uses.
  return Math.max(clericUses, paladinUses)
}

export function getChannelDivinityPool(
  character: CharacterTemplate,
): ChannelDivinityPool | undefined {
  const max = getChannelDivinityMax(character)
  if (max <= 0) return undefined

  const savedUsed = character.get("magic")?.channelDivinity?.used ?? 0
  const used = Math.min(max, Math.max(0, Math.trunc(savedUsed) || 0))

  return {
    max,
    used,
    current: max - used,
  }
}

export function spendChannelDivinity(
  character: CharacterTemplate,
): CharacterTemplate {
  const pool = getChannelDivinityPool(character)
  if (!pool || pool.current <= 0) return character
  return withChannelDivinityUsed(character, pool.used + 1)
}

export function restoreChannelDivinity(
  character: CharacterTemplate,
): CharacterTemplate {
  const pool = getChannelDivinityPool(character)
  if (!pool || pool.used <= 0) return character
  return withChannelDivinityUsed(character, pool.used - 1)
}

export function recoverChannelDivinity(
  character: CharacterTemplate,
  fraction = 1,
): CharacterTemplate {
  const pool = getChannelDivinityPool(character)
  if (!pool || pool.used <= 0) return character

  const normalizedFraction = Math.max(0, Math.min(1, fraction))
  const recovered = Math.ceil(pool.used * normalizedFraction)
  return withChannelDivinityUsed(character, pool.used - recovered)
}

function withChannelDivinityUsed(
  character: CharacterTemplate,
  used: number,
): CharacterTemplate {
  const max = getChannelDivinityMax(character)
  if (max <= 0) return character

  const magic = character.getOrCreateMagic()
  return character.with("magic", {
    ...magic,
    channelDivinity: {
      used: Math.min(max, Math.max(0, Math.trunc(used) || 0)),
    },
  })
}
''',
)


# Channel Divinity tracker in the spells tab.
write(
    "src/features/characters/magic/channelDivinityModule.tsx",
    '''import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import {
  getChannelDivinityPool,
  restoreChannelDivinity,
  spendChannelDivinity,
} from "../../../models/characters/characterChannelDivinity"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"

 type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function ChannelDivinityModule({
  character,
  updateCharacter,
}: Props) {
  const pool = getChannelDivinityPool(character)
  if (!pool) return null

  const clericLevel = character.getClassLevel("cleric")
  const paladinLevel = character.getClassLevel("paladin")
  const sources = [
    clericLevel >= 2 ? `Clérigo ${clericLevel}` : undefined,
    paladinLevel >= 3 ? `Paladino ${paladinLevel}` : undefined,
  ].filter((entry): entry is string => Boolean(entry))

  function spend() {
    updateCharacter(character.get("id"), (current) =>
      spendChannelDivinity(current),
    )
  }

  function restore() {
    updateCharacter(character.get("id"), (current) =>
      restoreChannelDivinity(current),
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">
          Canalizar Divindade
        </div>
        <div className="mt-1 text-xs text-text">
          Cargas calculadas automaticamente pelo nível de classe.
        </div>
      </CardHeader>

      <CardContent>
        <div className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-textH">
              {pool.current}/{pool.max} disponíveis
            </div>
            <div className="mt-1 text-[10px] text-textMuted">
              {sources.join(" • ")} • recupera em descanso curto ou longo
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={pool.current <= 0}
              onClick={spend}
            >
              Gastar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={pool.current >= pool.max}
              onClick={restore}
            >
              Restaurar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
'''.replace('\n type Props', '\ntype Props'),
)


# Render tracker in magic tab.
path = "src/features/characters/magic/characterMagicModule.tsx"
text = read(path)
text = replace_once(
    text,
    'import { KnownSpellsList } from "./knownSpellsList"',
    'import { ChannelDivinityModule } from "./channelDivinityModule"\nimport { KnownSpellsList } from "./knownSpellsList"',
    "magic tab channel divinity import",
)
text = replace_once(
    text,
    '''        {hasSorcererResources ? (
          <MetamagicModule''',
    '''        <ChannelDivinityModule
          character={character}
          updateCharacter={updateCharacter}
        />

        {hasSorcererResources ? (
          <MetamagicModule''',
    "magic tab channel divinity module",
)
write(path, text)


# Restore Channel Divinity on rests.
path = "src/models/characters/characterRest.ts"
text = read(path)
text = replace_once(
    text,
    'import type { CharacterTemplate } from "./CharacterTemplate"',
    'import { recoverChannelDivinity } from "./characterChannelDivinity"\nimport type { CharacterTemplate } from "./CharacterTemplate"',
    "rest channel divinity import",
)
text = replace_once(
    text,
    '''      )

  const magic = nextCharacter.get("magic")''',
    '''      )

  nextCharacter = recoverChannelDivinity(nextCharacter, recoveryFraction)

  const magic = nextCharacter.get("magic")''',
    "rest channel divinity recovery",
)
write(path, text)


# Ability category/tag and filter.
path = "src/models/abilities/Ability.ts"
text = read(path)
text = replace_once(
    text,
    "export type AbilityCategory = 'general' | 'invocation' | 'feat'",
    "export type AbilityCategory = 'general' | 'invocation' | 'feat' | 'channelDivinity'",
    "ability channel divinity category",
)
write(path, text)

path = "src/features/characters/abilities/abilityDialog.tsx"
text = read(path)
text = replace_once(
    text,
    '''                <option value="feat">Talento</option>''',
    '''                <option value="feat">Talento</option>
                <option value="channelDivinity">Canalizar Divindade</option>''',
    "ability dialog channel divinity category",
)
write(path, text)

path = "src/features/characters/abilities/characterAbilities.tsx"
text = read(path)
text = replace_once(
    text,
    '''  | "invocation"
  | "feat"''',
    '''  | "invocation"
  | "feat"
  | "channelDivinity"''',
    "ability filter type",
)
text = replace_once(
    text,
    '''            case "feat":
              return ability.category === "feat"
            default:''',
    '''            case "feat":
              return ability.category === "feat"
            case "channelDivinity":
              return ability.category === "channelDivinity"
            default:''',
    "ability filter switch",
)
text = replace_once(
    text,
    '''                evocações e talentos.''',
    '''                evocações, talentos e Canalizar Divindade.''',
    "ability tab description",
)
text = replace_once(
    text,
    '''              <option value="feat">Talentos</option>''',
    '''              <option value="feat">Talentos</option>
              <option value="channelDivinity">Canalizar Divindade</option>''',
    "ability filter option",
)
text = replace_once(
    text,
    '''  if (ability.category === "feat") return "Talento"
  return undefined''',
    '''  if (ability.category === "feat") return "Talento"
  if (ability.category === "channelDivinity") return "Canalizar Divindade"
  return undefined''',
    "ability category label",
)
write(path, text)


# Alignment model and profile persistence.
path = "src/models/characters/characterProfile.ts"
text = read(path)
text = replace_once(
    text,
    '''export type CharacterProfile = {''',
    '''export type CharacterAlignment =
  | "lawful-good"
  | "neutral-good"
  | "chaotic-good"
  | "lawful-neutral"
  | "true-neutral"
  | "chaotic-neutral"
  | "lawful-evil"
  | "neutral-evil"
  | "chaotic-evil"
  | "unaligned"

export type CharacterProfile = {''',
    "profile alignment type",
)
text = replace_once(
    text,
    '''  traits: string
  history: string''',
    '''  traits: string
  alignment?: CharacterAlignment
  history: string''',
    "profile alignment field",
)
write(path, text)

path = "src/models/characters/CharacterTemplate.ts"
text = read(path)
text = replace_once(
    text,
    '''        traits: props.profile?.traits ?? "",
        history: props.profile?.history ?? "",''',
    '''        traits: props.profile?.traits ?? "",
        alignment: props.profile?.alignment,
        history: props.profile?.history ?? "",''',
    "profile alignment normalization",
)
text = replace_once(
    text,
    '''        relationships: Array.isArray(props.profile?.relationships)
          ? props.profile.relationships
          : [],
      },''',
    '''        relationships: Array.isArray(props.profile?.relationships)
          ? props.profile.relationships
          : [],
        background: props.profile?.background,
      },''',
    "profile background preservation",
)
write(path, text)

path = "src/features/characters/profile/characterProfile.tsx"
text = read(path)
text = replace_once(
    text,
    'import { Input } from "../../../components/ui/Input"',
    'import { Input } from "../../../components/ui/Input"\nimport { Select } from "../../../components/ui/Select"',
    "profile select import",
)
text = replace_once(
    text,
    'import type { CharacterRelationship } from "../../../models/characters/characterProfile"',
    '''import type {
  CharacterAlignment,
  CharacterRelationship,
} from "../../../models/characters/characterProfile"''',
    "profile alignment import",
)
text = replace_once(
    text,
    '''const MAX_IMAGE_SIZE_MB = 1.5
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024''',
    '''const MAX_IMAGE_SIZE_MB = 1.5
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

const ALIGNMENT_OPTIONS: Array<{
  value: CharacterAlignment
  label: string
}> = [
  { value: "lawful-good", label: "Leal e Bom" },
  { value: "neutral-good", label: "Neutro e Bom" },
  { value: "chaotic-good", label: "Caótico e Bom" },
  { value: "lawful-neutral", label: "Leal e Neutro" },
  { value: "true-neutral", label: "Neutro" },
  { value: "chaotic-neutral", label: "Caótico e Neutro" },
  { value: "lawful-evil", label: "Leal e Mau" },
  { value: "neutral-evil", label: "Neutro e Mau" },
  { value: "chaotic-evil", label: "Caótico e Mau" },
  { value: "unaligned", label: "Sem alinhamento" },
]''',
    "profile alignment options",
)
text = replace_once(
    text,
    '''            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">
                Traços de personalidade''',
    '''            <label className="grid max-w-sm gap-1.5">
              <span className="text-xs font-medium text-textH">
                Alinhamento
              </span>
              <Select
                value={profile.alignment ?? ""}
                onChange={(event) =>
                  updateProfile(
                    "alignment",
                    event.target.value
                      ? (event.target.value as CharacterAlignment)
                      : undefined,
                  )
                }
              >
                <option value="">Não definido</option>
                {ALIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-textH">
                Traços de personalidade''',
    "profile alignment field",
)
write(path, text)
