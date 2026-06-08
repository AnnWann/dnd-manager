import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type {
  Ability,
  AbilityActionKind,
  AbilityKind,
  AbilityTrigger,
  AbilityUsageCooldownUnit,
  AbilityUsageResetKind,
} from "../../../models/abilities/Ability"
import {
  ABILITY_ACTION_OPTIONS,
  ABILITY_KIND_OPTIONS,
  ABILITY_TRIGGER_OPTIONS,
  COOLDOWN_UNIT_OPTIONS,
  USAGE_OPTIONS,
} from "./abilityOptions"

type Props = {
  open: boolean
  ability: Ability | null
  onClose: () => void
  onSave: (ability: Ability) => void
}

function createEmptyAbility(): Ability {
  return {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    kind: "active",
    actionKind: "action",
    trigger: "always",
  }
}

export function AbilityDialog({ open, ability, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Ability>(() =>
    ability ?? createEmptyAbility(),
  )

  useEffect(() => {
    if (open) {
      setDraft(ability ?? createEmptyAbility())
    }
  }, [open, ability])

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  if (!open) return null

  const hasUsage = draft.usage !== undefined

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex h-screen w-screen items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-lg rounded-lg border border-border p-4 shadow-xl"
          style={{ backgroundColor: "var(--bg)" }}>
        <h2 className="text-sm font-medium text-textH">
          {ability ? "Editar habilidade" : "Adicionar habilidade"}
        </h2>

        <div className="mt-4 grid gap-3">
          <div>
            <label className="text-xs text-text">Nome</label>
            <Input
              className="mt-1"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-text">Descrição</label>
            <Input
              className="mt-1"
              value={draft.description ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text">Tipo</label>
              <Select
                className="mt-1"
                value={draft.kind ?? "active"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    kind: e.target.value as AbilityKind,
                  })
                }
              >
                {ABILITY_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs text-text">Ação</label>
              <Select
                className="mt-1"
                value={draft.actionKind ?? "action"}
                disabled={draft.kind === "passive"}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    actionKind: e.target.value as AbilityActionKind,
                  })
                }
              >
                {ABILITY_ACTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-text">Gatilho</label>
            <Select
              className="mt-1"
              value={draft.trigger ?? "always"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  trigger: e.target.value as AbilityTrigger,
                })
              }
            >
              {ABILITY_TRIGGER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={hasUsage}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  usage: e.target.checked
                    ? {
                        max: 1,
                        used: 0,
                        reset: "shortRest",
                      }
                    : undefined,
                })
              }
            />
            Tem contador de usos
          </label>

          {hasUsage && draft.usage ? (
            <div className="grid grid-cols-2 gap-2 rounded-md border border-border p-3">
              <div>
                <label className="text-xs text-text">Máximo</label>
                <Input
                  type="number"
                  min={1}
                  className="mt-1"
                  value={draft.usage.max}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      usage: {
                        ...draft.usage!,
                        max: Math.max(1, Number(e.target.value) || 1),
                      },
                    })
                  }
                />
              </div>

              <div>
                <label className="text-xs text-text">Usado</label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={draft.usage.used}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      usage: {
                        ...draft.usage!,
                        used: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                />
              </div>

              <div>
                <label className="text-xs text-text">Reset</label>
                <Select
                  className="mt-1"
                  value={draft.usage.reset}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      usage: {
                        ...draft.usage!,
                        reset: e.target.value as AbilityUsageResetKind,
                      },
                    })
                  }
                >
                  {USAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>

              {draft.usage.reset === "cooldown" ? (
                <>
                  <div>
                    <label className="text-xs text-text">Cooldown</label>
                    <Input
                      type="number"
                      min={1}
                      className="mt-1"
                      value={draft.usage.cooldownAmount ?? 1}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          usage: {
                            ...draft.usage!,
                            cooldownAmount: Math.max(
                              1,
                              Number(e.target.value) || 1,
                            ),
                          },
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs text-text">Unidade</label>
                    <Select
                      className="mt-1"
                      value={draft.usage.cooldownUnit ?? "turns"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          usage: {
                            ...draft.usage!,
                            cooldownUnit:
                              e.target.value as AbilityUsageCooldownUnit,
                          },
                        })
                      }
                    >
                      {COOLDOWN_UNIT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs text-text"
            onClick={onClose}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-xs text-textH"
            disabled={!draft.name.trim()}
            onClick={() => onSave(draft)}
          >
            Salvar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}