import { useMemo, useState } from "react"

import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  getDynamicSubclassSpellGrants,
} from "../../../models/leveling/DynamicSubclassSpellRules"
import {
  getExpandedClassProgression,
  getExpandedFeaturesAtLevel,
} from "../../../models/leveling/ExpandedClassProgression"
import {
  getSubclassSpellGrants,
  normalizeSpellName,
} from "../../../models/leveling/SpellSelectionRules"
import type { Spell } from "../../../models/magic/spells/Spell"
import type { ClassName } from "../../../models/sheet/Class"
import { getClassNamePt } from "../../../models/leveling/ClassLocalization"

const ALL_CLASSES: ClassName[] = [
  "artificer",
  "barbarian",
  "bard",
  "cleric",
  "druid",
  "fighter",
  "monk",
  "paladin",
  "ranger",
  "rogue",
  "sorcerer",
  "warlock",
  "wizard",
]

type Props = {
  character: CharacterTemplate
  spells: Spell[]
}

export function ProgressionReferencePanel({ character, spells }: Props) {
  const firstClass =
    character.get("sheet").classes?.[0]?.className ?? "fighter"
  const firstLevel =
    character.get("sheet").classes?.find(
      (entry) => entry.className === firstClass,
    )?.level ?? 1
  const [className, setClassName] = useState<ClassName>(firstClass)
  const [level, setLevel] = useState(Math.min(20, firstLevel + 1))
  const progression = getExpandedClassProgression(className)
  const currentSubclass = character
    .get("sheet")
    .classes?.find((entry) => entry.className === className)?.subclass?.id
  const [subclassId, setSubclassId] = useState(currentSubclass ?? "")
  const [spellQuery, setSpellQuery] = useState("")

  const features = useMemo(
    () =>
      Array.from({ length: level }, (_, index) => index + 1).flatMap(
        (featureLevel) =>
          getExpandedFeaturesAtLevel(
            className,
            featureLevel,
            subclassId || undefined,
          ),
      ),
    [className, level, subclassId],
  )
  const staticGrants = getSubclassSpellGrants(
    className,
    subclassId || undefined,
    level,
  ).flatMap((grant) =>
    grant.spellNames.map((spellName) => ({
      spellName,
      classLevel: grant.classLevel,
      mode: grant.mode,
    })),
  )
  const dynamicGrants = getDynamicSubclassSpellGrants(
    character,
    className,
    subclassId || undefined,
    level,
  ).map((grant) => ({
    spellName: grant.spellName,
    classLevel: grant.classLevel,
    mode: grant.mode,
  }))
  const grants = [...staticGrants, ...dynamicGrants]
  const normalizedQuery = normalizeSpellName(spellQuery)
  const classSpells = spells
    .filter((spell) => spell.classes.includes(className))
    .filter(
      (spell) =>
        !normalizedQuery ||
        normalizeSpellName(
          `${spell.displayName ?? ""} ${spell.name} ${spell.school} ${spell.description}`,
        ).includes(normalizedQuery),
    )
    .toSorted(
      (left, right) =>
        left.slotLevel - right.slotLevel ||
        spellLabel(left).localeCompare(spellLabel(right), "pt-BR"),
    )

  function changeClass(nextClass: ClassName) {
    setClassName(nextClass)
    const entry = character
      .get("sheet")
      .classes?.find((current) => current.className === nextClass)
    setLevel(Math.min(20, (entry?.level ?? 0) + 1 || 1))
    setSubclassId(entry?.subclass?.id ?? "")
    setSpellQuery("")
  }

  return (
    <details className="mx-auto mt-5 w-full max-w-6xl rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-sm sm:p-5">
      <summary className="cursor-pointer font-semibold text-textH">
        Consultar detalhes de classes, características, escolhas e magias
      </summary>
      <p className="mt-2 text-xs leading-5 text-textMuted">
        Este painel é somente uma referência. Ele não altera as escolhas da progressão; use-o para ler o texto completo antes de confirmar.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="grid gap-1.5 text-xs text-text">
          Classe
          <Select
            value={className}
            onChange={(event) =>
              changeClass(event.target.value as ClassName)
            }
          >
            {ALL_CLASSES.map((entry) => (
              <option key={entry} value={entry}>
                {getClassNamePt(entry)}
              </option>
            ))}
          </Select>
        </label>
        <label className="grid gap-1.5 text-xs text-text">
          Nível da classe
          <Input
            type="number"
            min={1}
            max={20}
            value={level}
            onChange={(event) =>
              setLevel(
                Math.max(
                  1,
                  Math.min(20, Math.trunc(Number(event.target.value) || 1)),
                ),
              )
            }
          />
        </label>
        <label className="grid gap-1.5 text-xs text-text">
          Subclasse
          <Select
            value={subclassId}
            onChange={(event) => setSubclassId(event.target.value)}
          >
            <option value="">Sem subclasse selecionada</option>
            {progression.subclasses.map((subclass) => (
              <option key={subclass.id} value={subclass.id}>
                {subclass.name} · {subclass.source}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <section className="mt-5">
        <h3 className="text-sm font-semibold text-textH">
          Características até o nível {level}
        </h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {features.map((feature) => (
            <article
              key={`${className}:${subclassId}:${feature.id}`}
              className="rounded-xl border border-border bg-bg-subtle p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-textH">
                  {feature.name}
                </strong>
                <Badge>Nível {feature.level}</Badge>
                <Badge>{feature.source}</Badge>
                {feature.optional ? <Badge>Opcional</Badge> : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                {feature.description || "Sem descrição cadastrada."}
              </p>
              {feature.choice ? (
                <div className="mt-3 rounded-lg border border-accentBorder bg-accentBg p-3 text-xs">
                  <div className="font-semibold text-textH">
                    {feature.choice.label} · escolha {feature.choice.count}
                  </div>
                  {feature.choice.description ? (
                    <p className="mt-1 leading-5 text-textMuted">
                      {feature.choice.description}
                    </p>
                  ) : null}
                  {feature.choice.options?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {feature.choice.options.map((option) => (
                        <Badge key={option}>{option}</Badge>
                      ))}
                    </div>
                  ) : feature.choice.allowCustom ? (
                    <p className="mt-2 text-textMuted">
                      Esta escolha permite uma opção personalizada.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
          {!features.length ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-textMuted">
              Nenhuma característica encontrada para esta combinação.
            </div>
          ) : null}
        </div>
      </section>

      {grants.length ? (
        <section className="mt-5">
          <h3 className="text-sm font-semibold text-textH">
            Magias concedidas ou adicionadas pela subclasse
          </h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {grants.map((grant, index) => {
              const spell = findSpell(spells, grant.spellName)
              return (
                <article
                  key={`${grant.spellName}:${grant.classLevel}:${index}`}
                  className="rounded-xl border border-border bg-bg-subtle p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm text-textH">
                      {spell ? spellLabel(spell) : grant.spellName}
                    </strong>
                    <Badge>Nível de classe {grant.classLevel}</Badge>
                    <Badge>{grantModeLabel(grant.mode)}</Badge>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                    {spell?.description ||
                      "A descrição não está disponível no compêndio carregado."}
                  </p>
                </article>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-5 border-t border-border pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-textH">
              Lista de magias de {getClassNamePt(className)}
            </h3>
            <p className="mt-1 text-xs text-textMuted">
              Abra qualquer magia para ler a descrição completa.
            </p>
          </div>
          <label className="grid gap-1.5 text-xs text-text">
            Buscar magia
            <Input
              value={spellQuery}
              placeholder="Nome, escola ou texto"
              onChange={(event) => setSpellQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-3 grid max-h-[36rem] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {classSpells.map((spell) => (
            <details
              key={spell.index}
              className="rounded-lg border border-border bg-bg-subtle p-3"
            >
              <summary className="cursor-pointer text-sm font-medium text-textH">
                {spellLabel(spell)} · {spell.slotLevel === 0 ? "Truque" : `Nível ${spell.slotLevel}`} · {String(spell.school)}
              </summary>
              <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-textMuted">
                {spell.description || "Sem descrição cadastrada."}
              </p>
            </details>
          ))}
        </div>
      </section>
    </details>
  )
}

function findSpell(spells: Spell[], name: string): Spell | undefined {
  const normalized = normalizeSpellName(name)
  return spells.find(
    (spell) =>
      normalizeSpellName(spell.name) === normalized ||
      normalizeSpellName(spell.displayName ?? "") === normalized,
  )
}

function spellLabel(spell: Spell): string {
  return spell.displayName?.trim() || spell.name
}

function grantModeLabel(mode: string): string {
  if (mode === "always-prepared") return "Sempre preparada"
  if (mode === "bonus-known") return "Conhecida adicional"
  return "Lista expandida"
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {children}
    </span>
  )
}
