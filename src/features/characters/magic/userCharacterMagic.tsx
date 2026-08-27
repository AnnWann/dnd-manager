import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import { Input } from "../../../components/ui/Input"
import { CLASS_NAMES, MAGIC_SCHOOLS_MAP } from "../../../contexts/consts"
import { useMagicContext } from "../../../contexts/magicContext"
import { getCharacterGrantedSpells } from "../../../models/characters/characterGrantedSpells"
import { getCustomSpellSlotPools } from "../../../models/characters/customClassConfig"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { SpellSource } from "../../../models/magic/spells/SpellSource"
import type { MagicCircleLevel } from "../../../models/magic/spells/spellDefinitions"
import type { ClassName } from "../../../models/sheet/Class"
import { useCharacterWorkspace } from "../workspace/CharacterWorkspaceContext"
import { isPreparedClassName } from "./preparedClassSpellAccess"
import { PreparedClassSpellList } from "./PreparedClassSpellList"

type Props = {
  character: CharacterTemplate
}

type DisplaySpell = {
  key: string
  spell: Spell
  source: SpellSource
  prepared: boolean
  granted: boolean
}

type LevelFilter = "all" | "cantrip" | `${number}`
type SourceFilter = "all" | SpellSource["type"]

const SLOT_LEVELS: MagicCircleLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9]

/**
 * User-context magic view.
 *
 * This screen describes the durable spell definition of the character. It does
 * not cast spells, spend/restore slots, consume granted uses or mutate runtime
 * resources. Gameplay state remains exclusive to the session character view.
 */
export function UserCharacterMagicTab({ character }: Props) {
  const navigate = useNavigate()
  const {
    isEditing = false,
    updateCharacter,
  } = useCharacterWorkspace()
  const { getSpellByIndex } = useMagicContext()
  const [search, setSearch] = useState("")
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")

  const spells = useMemo<DisplaySpell[]>(() => {
    const result: DisplaySpell[] = []

    for (const entry of character.get("magic")?.spells.knownSpells ?? []) {
      if (
        entry.source.type === "class" &&
        isPreparedClassName(entry.source.sourceId)
      ) {
        continue
      }

      const spell = getSpellByIndex(entry.spells.id)
      if (!spell) continue
      result.push({
        key: `known:${entry.source.type}:${entry.source.sourceId}:${spell.index}`,
        spell,
        source: entry.source,
        prepared: entry.spells.prepared,
        granted: false,
      })
    }

    for (const grant of getCharacterGrantedSpells(character)) {
      if (
        grant.usageSource?.type === "condition" ||
        grant.source.sourceId.startsWith("condition:")
      ) {
        continue
      }

      const spell = getSpellByIndex(grant.index)
      if (!spell) continue
      result.push({
        key: `grant:${grant.key}`,
        spell,
        source: grant.source,
        prepared: true,
        granted: true,
      })
    }

    return result.toSorted(
      (left, right) =>
        left.spell.slotLevel - right.spell.slotLevel ||
        spellName(left.spell).localeCompare(spellName(right.spell), "pt-BR"),
    )
  }, [character, getSpellByIndex])

  const sourceTypes = useMemo(
    () => Array.from(new Set(spells.map((entry) => entry.source.type))),
    [spells],
  )

  const visibleSpells = useMemo(() => {
    const normalizedSearch = normalize(search)
    return spells.filter((entry) => {
      const matchesSearch =
        !normalizedSearch ||
        normalize(
          `${entry.spell.displayName ?? ""} ${entry.spell.name} ${entry.spell.description ?? ""}`,
        ).includes(normalizedSearch)
      const matchesLevel =
        levelFilter === "all" ||
        (levelFilter === "cantrip"
          ? entry.spell.slotLevel === 0
          : entry.spell.slotLevel === Number(levelFilter))
      const matchesSource =
        sourceFilter === "all" || entry.source.type === sourceFilter
      return matchesSearch && matchesLevel && matchesSource
    })
  }, [levelFilter, search, sourceFilter, spells])

  const slots = character.getSpellSlots()
  const pactSlots = character.getPactSlots()
  const customPools = getCustomSpellSlotPools(character)
  const hasSlotCapacity =
    SLOT_LEVELS.some((level) => (slots[level]?.max ?? 0) > 0) ||
    Boolean(pactSlots?.max) ||
    customPools.some((pool) =>
      SLOT_LEVELS.some((level) => (pool.slots[level]?.max ?? 0) > 0),
    )

  function removeKnownSpell(entry: DisplaySpell) {
    if (entry.granted) return

    const name = spellName(entry.spell)
    if (!window.confirm(`Remover ${name} da lista de magias do personagem?`)) {
      return
    }

    updateCharacter(character.get("id"), (current) =>
      current.removeSpell(entry.spell.index),
    )
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-textH">Magia</div>
              <div className="mt-1 text-xs text-textMuted">
                Capacidade mágica da build. Espaços exibem apenas o máximo; consumo pertence à sessão.
              </div>
            </div>

            {isEditing ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  navigate(
                    `/user/characters/${encodeURIComponent(character.get("id"))}/add-spells`,
                  )
                }
              >
                + Adicionar magia
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {!hasSlotCapacity ? (
            <p className="text-xs text-textMuted">
              Este personagem não possui espaços de magia configurados.
            </p>
          ) : (
            <div className="grid gap-3">
              <div className="flex flex-wrap gap-2">
                {SLOT_LEVELS.map((level) => {
                  const maximum = slots[level]?.max ?? 0
                  if (maximum <= 0) return null
                  return (
                    <CapacityPill key={level}>
                      {level}º círculo: {maximum}
                    </CapacityPill>
                  )
                })}

                {pactSlots?.max ? (
                  <CapacityPill>
                    Pacto — {pactSlots.level}º círculo: {pactSlots.max}
                  </CapacityPill>
                ) : null}
              </div>

              {customPools.map((pool) => {
                const configured = SLOT_LEVELS.flatMap((level) => {
                  const maximum = pool.slots[level]?.max ?? 0
                  return maximum > 0 ? [{ level, maximum }] : []
                })
                if (!configured.length) return null

                return (
                  <div
                    key={pool.id}
                    className="rounded-xl border border-border bg-bg-subtle p-3"
                  >
                    <div className="text-xs font-semibold text-textH">
                      {pool.name}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {configured.map(({ level, maximum }) => (
                        <CapacityPill key={`${pool.id}:${level}`}>
                          {level}º círculo: {maximum}
                        </CapacityPill>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <PreparedClassSpellList
        character={character}
        updateCharacter={updateCharacter}
      />

      <Card>
        <CardHeader>
          <div className="text-sm font-semibold text-textH">
            Conhecidas e concedidas
          </div>
          <div className="mt-1 text-xs text-textMuted">
            Magias aprendidas individualmente e magias permanentes concedidas pela ficha.
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-[minmax(220px,1fr)_170px_190px]">
            <Input
              value={search}
              placeholder="Buscar magia..."
              onChange={(event) => setSearch(event.target.value)}
            />

            <select
              className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-textH"
              value={levelFilter}
              onChange={(event) =>
                setLevelFilter(event.target.value as LevelFilter)
              }
            >
              <option value="all">Todos os círculos</option>
              <option value="cantrip">Truques</option>
              {SLOT_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}º círculo
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-textH"
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(event.target.value as SourceFilter)
              }
            >
              <option value="all">Todas as origens</option>
              {sourceTypes.map((type) => (
                <option key={type} value={type}>
                  {sourceTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {visibleSpells.length === 0 ? (
            <p className="text-xs text-textMuted">Nenhuma magia encontrada.</p>
          ) : (
            <div className="grid gap-3">
              {visibleSpells.map((entry) => (
                <UserSpellCard
                  key={entry.key}
                  entry={entry}
                  canRemove={isEditing && !entry.granted}
                  onRemove={() => removeKnownSpell(entry)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function UserSpellCard({
  entry,
  canRemove,
  onRemove,
}: {
  entry: DisplaySpell
  canRemove: boolean
  onRemove: () => void
}) {
  const spell = entry.spell
  const description = spell.description?.trim() ?? ""

  return (
    <article className="rounded-2xl border border-border bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-1 text-sm font-semibold text-textH">
          {spellName(spell)}
        </h3>
        <DefinitionPill>{formatSpellLevel(spell.slotLevel)}</DefinitionPill>
        <DefinitionPill>
          {MAGIC_SCHOOLS_MAP[String(spell.school)] ?? String(spell.school)}
        </DefinitionPill>
        <DefinitionPill>{sourceLabel(entry.source)}</DefinitionPill>
        {entry.granted ? <DefinitionPill>Concedida</DefinitionPill> : null}
        {!entry.granted && entry.prepared && spell.slotLevel > 0 ? (
          <DefinitionPill>Preparada</DefinitionPill>
        ) : null}
        {spell.concentration ? <DefinitionPill>Concentração</DefinitionPill> : null}
        {spell.ritual ? <DefinitionPill>Ritual</DefinitionPill> : null}
        {canRemove ? (
          <Button
            size="sm"
            variant="danger"
            className="ml-auto"
            onClick={onRemove}
          >
            Remover
          </Button>
        ) : null}
      </div>

      {description ? (
        <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-text">
          {description}
        </p>
      ) : (
        <p className="mt-3 text-xs text-textMuted">Sem descrição cadastrada.</p>
      )}

      {spell.higherLevelText?.trim() ? (
        <details className="mt-3 border-t border-border pt-3 text-xs text-textMuted">
          <summary className="cursor-pointer font-medium text-textH">
            Em círculos superiores
          </summary>
          <div className="mt-2 whitespace-pre-wrap leading-5">
            {spell.higherLevelText.trim()}
          </div>
        </details>
      ) : null}
    </article>
  )
}

function CapacityPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-3 py-1.5 text-xs font-semibold text-textH">
      {children}
    </span>
  )
}

function DefinitionPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-bg-subtle px-2.5 py-1 text-[11px] font-medium text-text">
      {children}
    </span>
  )
}

function sourceTypeLabel(type: SpellSource["type"]): string {
  if (type === "class") return "Classes"
  if (type === "ability") return "Habilidades"
  if (type === "feat") return "Talentos"
  if (type === "race") return "Raça"
  return "Equipamentos"
}

function sourceLabel(source: SpellSource): string {
  if (source.type === "class") {
    return CLASS_NAMES[source.name as ClassName] ?? source.name
  }
  if (source.type === "ability") return source.name || "Habilidade"
  if (source.type === "feat") return source.name || "Talento"
  if (source.type === "race") return source.name || "Raça"
  return source.name || "Equipamento"
}

function spellName(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function formatSpellLevel(level: number): string {
  return level === 0 ? "Truque" : `${level}º círculo`
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
}
