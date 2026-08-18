import { useMemo, useState } from "react"

import { Input } from "../components/ui/Input"
import { useMagicContext } from "../contexts/magicContext"
import {
  SpellLibraryView,
  type SpellLibraryRecord,
} from "../features/magic/library/SpellLibraryView"
import type { Spell, SpellResourceType } from "../models/magic/spells/Spell"
import { SPELL_RESOURCE_OPTIONS } from "../models/magic/spells/spellResourceCost"

export function MagicView() {
  const { savedSpells } = useMagicContext()
  const [resourceType, setResourceType] = useState<SpellResourceType | "slot">("slot")
  const [resourceAmount, setResourceAmount] = useState(1)

  const records = useMemo<SpellLibraryRecord[]>(
    () =>
      savedSpells.map((spell) => ({
        index: spell.index,
        owned: true,
      })),
    [savedSpells],
  )

  function beginEditor(spell: Spell | null) {
    setResourceType(spell?.resourceCost?.resource ?? "slot")
    setResourceAmount(
      Math.max(1, Math.trunc(spell?.resourceCost?.amount ?? 1)),
    )
  }

  function prepareSpellForSave(spell: Spell): Spell {
    return {
      ...spell,
      resourceCost:
        resourceType === "slot"
          ? undefined
          : {
              resource: resourceType,
              amount: resourceAmount,
            },
    }
  }

  return (
    <SpellLibraryView
      variant="session"
      records={records}
      onEditorOpen={beginEditor}
      prepareSpellForSave={prepareSpellForSave}
      creatorPrelude={
        <section className="rounded-xl border border-accentBorder bg-bg p-3">
          <div className="text-xs font-semibold text-textH">
            Recurso de conjuração
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem]">
            <label className="grid gap-1 text-xs text-text">
              Recurso
              <select
                className="h-9 w-full rounded-xl border border-accentBorder bg-bg px-3 text-text outline-none transition-colors focus:border-accent"
                value={resourceType}
                onChange={(event) =>
                  setResourceType(
                    event.target.value as SpellResourceType | "slot",
                  )
                }
              >
                <option value="slot">Espaço de magia (padrão)</option>
                {SPELL_RESOURCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {resourceType !== "slot" ? (
              <label className="grid gap-1 text-xs text-text">
                Custo
                <Input
                  type="number"
                  min={1}
                  value={resourceAmount}
                  onChange={(event) =>
                    setResourceAmount(
                      Math.max(
                        1,
                        Math.trunc(Number(event.target.value) || 1),
                      ),
                    )
                  }
                />
              </label>
            ) : null}
          </div>

          {resourceType !== "slot" ? (
            <p className="mt-2 text-[11px] text-textMuted">
              Esse recurso substitui o gasto de espaço de magia ao usar a
              magia nesta sessão.
            </p>
          ) : null}
        </section>
      }
    />
  )
}
