import { useMemo, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Card, CardContent, CardHeader } from "../../../components/ui/Card"
import type { Ability } from "../../../models/abilities/Ability"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { getInvocationLimit } from "../../../rules/InvocationRules"
import { AbilityDialog } from "../abilities/abilityDialog"

type Props = {
  character: CharacterTemplate
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function InvocationModule({ character, updateCharacter }: Props) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Ability | null>(null)
  const warlockLevel = character.getClassLevel("warlock")
  const maximum = getInvocationLimit(warlockLevel)
  const invocations = useMemo(
    () => collectInvocations(character),
    [character],
  )

  function save(ability: Ability) {
    updateCharacter(character.get("id"), (current) => {
      const currentInvocations = collectInvocations(current)
      const invocation: Ability = {
        ...ability,
        category: "invocation",
        source: "class",
      }
      const exists = currentInvocations.some(
        (entry) => entry.id === invocation.id,
      )
      if (!exists && currentInvocations.length >= maximum) return current

      return current.saveAbility(invocation)
    })
    setEditorOpen(false)
    setEditing(null)
  }

  function remove(id: string) {
    updateCharacter(character.get("id"), (current) =>
      current.removeAbility(id),
    )
  }

  if (warlockLevel <= 0) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-textH">Evocações</div>
            <div className="mt-1 text-xs text-text">
              {invocations.length}/{maximum} configuradas
            </div>
          </div>
          <Button
            size="sm"
            disabled={maximum <= 0 || invocations.length >= maximum}
            onClick={() => {
              setEditing(null)
              setEditorOpen(true)
            }}
          >
            Adicionar
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {invocations.length ? (
          <div className="grid gap-2">
            {invocations.map((invocation) => (
              <article
                key={invocation.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-border bg-bg p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-textH">{invocation.name}</div>
                  {invocation.description?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-textMuted">
                      {invocation.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(invocation)
                      setEditorOpen(true)
                    }}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(invocation.id)}
                  >
                    Remover
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-xs text-textMuted">
            Nenhuma evocação configurada.
          </div>
        )}
      </CardContent>

      <AbilityDialog
        open={editorOpen}
        ability={editing}
        title={editing ? "Editar evocação" : "Adicionar evocação"}
        fixedCategory="invocation"
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
        onSave={save}
      />
    </Card>
  )
}

function collectInvocations(character: CharacterTemplate): Ability[] {
  const byId = new Map<string, Ability>()
  for (const invocation of character.get("magic")?.invocations ?? []) {
    byId.set(invocation.id, { ...invocation, category: "invocation" })
  }
  for (const ability of character.get("abilities") ?? []) {
    if (ability.category === "invocation") byId.set(ability.id, ability)
  }
  return Array.from(byId.values())
}
