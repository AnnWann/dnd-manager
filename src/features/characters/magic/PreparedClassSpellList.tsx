import { useEffect, useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { CLASS_NAMES, MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { createCharacterAcquisition } from "../../../models/characters/CharacterAcquisition"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { CharacterSpells } from "../../../models/magic/spells/CharacterSpells"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import {
  isPreparedClassListEntry,
  PREPARED_CLASS_LIST_MARKER,
} from "./preparedClassSpellAccess"
import {
  preparedClassSpellAccessKey,
  usePreparedClassSpellAccess,
  type PreparedClassSpellAccess,
} from "./usePreparedClassSpellAccess"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (current: CharacterTemplate) => CharacterTemplate,
  ) => void
}

type KnownSpellEntry = CharacterSpells["knownSpells"][number]

export function PreparedClassSpellList({ character, updateCharacter }: Props) {
  const workspace = useCharacterWorkspace()
  const access = usePreparedClassSpellAccess(character)
  const [search, setSearch] = useState("")
  const [classFilter, setClassFilter] = useState("all")
  const knownSpells = character.get("magic")?.spells.knownSpells ?? []
  const persistedByClassAndSpell = useMemo(
    () =>
      new Map(
        knownSpells.flatMap((entry) =>
          entry.source.type === "class"
            ? [[preparedClassSpellAccessKey(entry.source.sourceId, entry.spells.id), entry] as const]
            : [],
        ),
      ),
    [knownSpells],
  )

  useEffect(() => {
    if (!access.ready) return

    const stale = knownSpells.filter(
      (entry) =>
        entry.source.type === "class" &&
        isPreparedClassListEntry(entry.acquisition?.notes) &&
        !access.accessibleKeys.has(
          preparedClassSpellAccessKey(entry.source.sourceId, entry.spells.id),
        ),
    )
    if (!stale.length) return

    updateCharacter(character.get("id"), (current) => {
      let next = current
      for (const entry of stale) next = next.removeSpell(entry.spells.id)
      return next
    })
  }, [access.accessibleKeys, access.ready, character, knownSpells, updateCharacter])

  const classNames = useMemo(
    () => Array.from(new Set(access.entries.map((entry) => entry.classEntry.className))),
    [access.entries],
  )
  const normalizedSearch = normalize(search)
  const visibleEntries = access.entries.filter((entry) => {
    if (classFilter !== "all" && entry.classEntry.className !== classFilter) return false
    if (!normalizedSearch) return true
    return normalize(
      `${spellName(entry.spell)} ${entry.spell.name} ${entry.spell.description ?? ""}`,
    ).includes(normalizedSearch)
  })

  const canEdit = workspace.mode === "campaign" || workspace.isEditing === true

  if (!access.loading && access.ready && access.entries.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="text-sm font-semibold text-textH">Lista da classe</div>
        <div className="mt-1 text-xs text-textMuted">
          Magias de círculos que classes de preparação conhecem automaticamente. A lista acompanha o nível da classe; apenas a preparação é salva na ficha.
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_200px]">
          <Input
            value={search}
            placeholder="Buscar na lista da classe..."
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-textH"
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
          >
            <option value="all">Todas as classes</option>
            {classNames.map((className) => (
              <option key={className} value={className}>
                {CLASS_NAMES[className] ?? className}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent>
        {access.loading && !access.entries.length ? (
          <p className="text-xs text-textMuted">Carregando lista da classe...</p>
        ) : visibleEntries.length === 0 ? (
          <p className="text-xs text-textMuted">Nenhuma magia encontrada.</p>
        ) : (
          <div className="grid gap-2">
            {visibleEntries.map((entry) => {
              const key = preparedClassSpellAccessKey(
                entry.classEntry.className,
                entry.spell.index,
              )
              const persisted = persistedByClassAndSpell.get(key)
              const prepared = persisted?.spells.prepared === true
              const preparedLimit = entry.classEntry.knownSpells?.canPrepare?.(character)
              const preparedCount = countPreparedForClass(
                access.entries,
                persistedByClassAndSpell,
                entry.classEntry.className,
              )
              const canPrepare =
                prepared ||
                preparedLimit === undefined ||
                preparedCount < preparedLimit

              return (
                <article
                  key={`class-list:${key}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-bg-subtle p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-textH">
                        {spellName(entry.spell)}
                      </span>
                      <Pill>{entry.spell.slotLevel}º círculo</Pill>
                      <Pill>
                        {MAGIC_SCHOOLS_MAP[String(entry.spell.school)] ?? String(entry.spell.school)}
                      </Pill>
                      <Pill>{CLASS_NAMES[entry.classEntry.className] ?? entry.classEntry.className}</Pill>
                      {prepared ? <Pill>Preparada</Pill> : null}
                    </div>
                    {entry.spell.description?.trim() ? (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-textMuted">
                        {entry.spell.description.trim()}
                      </p>
                    ) : null}
                  </div>

                  {canEdit ? (
                    <Button
                      size="sm"
                      variant={prepared ? "secondary" : "primary"}
                      disabled={!canPrepare}
                      onClick={() =>
                        togglePreparedClassSpell(
                          character,
                          entry,
                          persisted,
                          !prepared,
                          updateCharacter,
                        )
                      }
                    >
                      {prepared ? "Despreparar" : "Preparar"}
                    </Button>
                  ) : null}
                </article>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function togglePreparedClassSpell(
  character: CharacterTemplate,
  entry: PreparedClassSpellAccess,
  persisted: KnownSpellEntry | undefined,
  prepared: boolean,
  updateCharacter: Props["updateCharacter"],
) {
  const characterId = character.get("id")
  if (persisted) {
    updateCharacter(characterId, (current) =>
      current.setSpellPrepared(entry.spell.index, prepared),
    )
    return
  }
  if (!prepared) return

  const characterLevel = (character.get("sheet").classes ?? []).reduce(
    (total, classEntry) => total + classEntry.level,
    0,
  )
  const className = entry.classEntry.className
  const spellEntry: KnownSpellEntry = {
    spells: {
      id: entry.spell.index,
      prepared: true,
    },
    source: entry.source,
    acquisition: createCharacterAcquisition({
      characterLevel,
      className,
      classLevel: entry.classEntry.level,
      sourceType: "class",
      sourceId: className,
      sourceName: CLASS_NAMES[className] ?? className,
      reason: "level-up",
      notes: PREPARED_CLASS_LIST_MARKER,
    }),
  }

  updateCharacter(characterId, (current) => current.addSpell(spellEntry))
}

function countPreparedForClass(
  entries: PreparedClassSpellAccess[],
  persisted: ReadonlyMap<string, KnownSpellEntry>,
  className: ClassName,
): number {
  return entries.reduce((total, entry) => {
    if (entry.classEntry.className !== className) return total
    const key = preparedClassSpellAccessKey(className, entry.spell.index)
    return total + (persisted.get(key)?.spells.prepared ? 1 : 0)
  }, 0)
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg px-2 py-0.5 text-[10px] font-medium text-textMuted">
      {children}
    </span>
  )
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}
