import { Component, useEffect, useState, type ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { confirmAndResetLocalAppData } from "../../../lib/resetLocalAppData"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { DieSides } from "../../../models/dice/Die"
import type { Player } from "../../../models/player/Player"
import type { Attribute } from "../../../models/sheet/Attribute"
import type {
  ClassName,
  KnownSpellMode,
  SpellcastingProgression,
} from "../../../models/sheet/Class"
import type { Skill } from "../../../models/sheet/Skills"
import { CharacterCreationWizard as BaseCharacterCreationWizard } from "./characterCreationWizardV4"
import { PHB_CLASS_PRESETS, type ClassPreset } from "./phbPresets"
import "./characterCreationWizardMobileFix.css"

export type CharacterCreationProgressionPlan = {
  className: ClassName
  targetLevel: number
}

const CUSTOM_CLASS_ID = "__custom__" as ClassName
const CUSTOM_CLASS_MARKER = "dnd-manager:custom-class"
const CUSTOM_CLASS_CHOICE_KEY = "dnd-manager:custom-class-name"

const ALL_SKILLS: Skill[] = [
  "acrobatics",
  "animalHandling",
  "arcana",
  "athletics",
  "deception",
  "history",
  "insight",
  "intimidation",
  "investigation",
  "medicine",
  "nature",
  "perception",
  "performance",
  "persuasion",
  "religion",
  "sleightOfHand",
  "stealth",
  "survival",
]

const ATTRIBUTE_OPTIONS: Array<{ value: Attribute; label: string }> = [
  { value: "str", label: "Força" },
  { value: "dex", label: "Destreza" },
  { value: "con", label: "Constituição" },
  { value: "int", label: "Inteligência" },
  { value: "wis", label: "Sabedoria" },
  { value: "cha", label: "Carisma" },
]

const HIT_DICE: DieSides[] = ["d4", "d6", "d8", "d10", "d12"]

type CustomCasterType = "none" | SpellcastingProgression

type CustomClassConfig = {
  name: string
  hitDie: DieSides
  casterType: CustomCasterType
  castingAttribute: Attribute
  knownSpellMode: KnownSpellMode
  knownAtLevel1: number
  knownPerLevel: number
  savingThrows: Attribute[]
  skillChoices: number
}

const DEFAULT_CUSTOM_CLASS_CONFIG: CustomClassConfig = {
  name: "Classe personalizada",
  hitDie: "d8",
  casterType: "none",
  castingAttribute: "int",
  knownSpellMode: "limited",
  knownAtLevel1: 2,
  knownPerLevel: 1,
  savingThrows: [],
  skillChoices: 2,
}

const CUSTOM_CLASS_PRESET: ClassPreset = {
  id: CUSTOM_CLASS_ID,
  name: "Classe personalizada",
  summary: "Base configurável para classes homebrew.",
  hitDie: DEFAULT_CUSTOM_CLASS_CONFIG.hitDie,
  savingThrows: [],
  skillChoices: DEFAULT_CUSTOM_CLASS_CONFIG.skillChoices,
  availableSkills: ALL_SKILLS,
  proficiencies: [
    {
      id: CUSTOM_CLASS_MARKER,
      name: CUSTOM_CLASS_MARKER,
      category: "other",
      notes: "Marcador interno removido ao concluir a criação.",
    },
  ],
  recommendedAttributes: {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
  },
}

function ensureCustomClassPreset() {
  if (PHB_CLASS_PRESETS.some((preset) => preset.id === CUSTOM_CLASS_ID)) return
  PHB_CLASS_PRESETS.push(CUSTOM_CLASS_PRESET)
}

function applyCustomPresetConfig(config: CustomClassConfig) {
  CUSTOM_CLASS_PRESET.hitDie = config.hitDie
  CUSTOM_CLASS_PRESET.savingThrows = [...config.savingThrows]
  CUSTOM_CLASS_PRESET.skillChoices = config.skillChoices
}

ensureCustomClassPreset()

type Props = {
  open: boolean
  defaultOwner: Player
  owners: Player[]
  canAssignOwners: boolean
  onClose: () => void
  onCreate: (
    character: CharacterTemplate,
    plan: CharacterCreationProgressionPlan,
  ) => void
  createOwner: (ownerName: string) => Player
  mode?: "modal" | "page"
}

type BoundaryProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
}

type BoundaryState = {
  error: Error | null
}

class CharacterCreationErrorBoundary extends Component<
  BoundaryProps,
  BoundaryState
> {
  state: BoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error }
  }

  componentDidUpdate(previous: BoundaryProps) {
    if (!previous.open && this.props.open && this.state.error) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    if (!this.props.open) return null

    return (
      <div className="fixed inset-0 z-[90] flex min-h-screen items-center justify-center overflow-y-auto bg-black/70 p-3">
        <div className="w-full max-w-lg rounded-xl border border-danger bg-bg-elevated p-4 shadow-theme-lg">
          <h2 className="text-base font-semibold text-textH">
            Não foi possível abrir esta etapa
          </h2>
          <p className="mt-2 text-sm leading-6 text-text">
            O criador encontrou um erro neste dispositivo. Você pode apenas fechar
            o criador ou limpar os dados locais para remover um estado antigo ou
            corrompido.
          </p>

          <details className="mt-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-textMuted">
            <summary className="cursor-pointer font-medium text-textH">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px]">
              {this.state.error.message || "Erro desconhecido"}
            </pre>
          </details>

          <div className="mt-3 rounded-lg border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
            “Limpar tudo neste dispositivo” apaga o estado local, a chave de
            sincronização, o nome do jogador e o papel selecionado. O estado salvo
            no servidor não é apagado.
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                this.setState({ error: null })
                this.props.onClose()
              }}
            >
              Fechar criador
            </Button>
            <Button variant="primary" onClick={confirmAndResetLocalAppData}>
              Limpar tudo neste dispositivo
            </Button>
          </div>
        </div>
      </div>
    )
  }
}

export function CharacterCreationWizard(props: Props) {
  const [customConfig, setCustomConfig] = useState<CustomClassConfig>({
    ...DEFAULT_CUSTOM_CLASS_CONFIG,
  })
  const [customClassDialogOpen, setCustomClassDialogOpen] = useState(false)

  useEffect(() => {
    if (!props.open) return

    const freshConfig: CustomClassConfig = {
      ...DEFAULT_CUSTOM_CLASS_CONFIG,
      savingThrows: [],
    }
    setCustomConfig(freshConfig)
    applyCustomPresetConfig(freshConfig)
  }, [props.open])

  useEffect(() => {
    if (!props.open || props.mode === "page") return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [props.open, props.mode])

  const { onCreate, ...baseProps } = props

  function detectCustomClassSelection(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement
    const button = target.closest("button")
    if (!button) return

    const label = button.textContent?.trim() ?? ""
    if (label.includes("Classe personalizada")) {
      setCustomClassDialogOpen(true)
    }
  }

  return (
    <CharacterCreationErrorBoundary open={props.open} onClose={props.onClose}>
      <div onClickCapture={detectCustomClassSelection}>
        <BaseCharacterCreationWizard
          {...baseProps}
          onCreate={(configuredCharacter) => {
            const initialClass = configuredCharacter.get("sheet").classes?.[0]

            if (!initialClass) {
              throw new Error(
                "A criação não definiu uma classe inicial válida.",
              )
            }

            const isCustomClass = configuredCharacter
              .get("sheet")
              .proficiencies.some((entry) => entry.id === CUSTOM_CLASS_MARKER)

            const customKnownSpells =
              customConfig.casterType === "none"
                ? undefined
                : {
                    mode: customConfig.knownSpellMode,
                    baseAtLevel1:
                      customConfig.knownSpellMode === "prepared-only"
                        ? 0
                        : customConfig.knownAtLevel1,
                    perLevel:
                      customConfig.knownSpellMode === "prepared-only"
                        ? 0
                        : customConfig.knownPerLevel,
                  }

            const finalizedCharacter = isCustomClass
              ? configuredCharacter.withPatch({
                  sheet: {
                    ...configuredCharacter.get("sheet"),
                    proficiencies: configuredCharacter
                      .get("sheet")
                      .proficiencies.filter((entry) => entry.id !== CUSTOM_CLASS_MARKER),
                    classes: [
                      {
                        ...initialClass,
                        className: "fighter",
                        castingAttribute:
                          customConfig.casterType === "none"
                            ? undefined
                            : customConfig.castingAttribute,
                        spellcastingProgression:
                          customConfig.casterType === "none"
                            ? undefined
                            : customConfig.casterType,
                        knownSpells: customKnownSpells,
                        levelChoices: {
                          ...(initialClass.levelChoices ?? {}),
                          [CUSTOM_CLASS_CHOICE_KEY]: [
                            customConfig.name.trim() || "Classe personalizada",
                          ],
                        },
                      },
                      ...(configuredCharacter.get("sheet").classes ?? []).slice(1),
                    ],
                  },
                })
              : configuredCharacter

            const finalizedInitialClass = finalizedCharacter.get("sheet").classes?.[0]
            if (!finalizedInitialClass) {
              throw new Error("A classe inicial não pôde ser finalizada.")
            }

            const targetLevel = Math.max(
              1,
              Math.min(20, Math.trunc(Number(finalizedInitialClass.level) || 1)),
            )

            onCreate(finalizedCharacter, {
              className: finalizedInitialClass.className,
              targetLevel,
            })
          }}
        />
      </div>

      <CustomClassDialog
        open={customClassDialogOpen}
        config={customConfig}
        onChange={(next) => {
          setCustomConfig(next)
          applyCustomPresetConfig(next)
        }}
        onClose={() => setCustomClassDialogOpen(false)}
      />
    </CharacterCreationErrorBoundary>
  )
}

function CustomClassDialog({
  open,
  config,
  onChange,
  onClose,
}: {
  open: boolean
  config: CustomClassConfig
  onChange: (config: CustomClassConfig) => void
  onClose: () => void
}) {
  if (!open) return null

  function patch(patchValue: Partial<CustomClassConfig>) {
    onChange({ ...config, ...patchValue })
  }

  function toggleSavingThrow(attribute: Attribute) {
    patch({
      savingThrows: config.savingThrows.includes(attribute)
        ? config.savingThrows.filter((entry) => entry !== attribute)
        : [...config.savingThrows, attribute],
    })
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-black/65 p-3 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-textH">
              Configurar classe personalizada
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Defina a estrutura mecânica que normalmente já vem configurada nas classes oficiais.
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs font-medium text-textH">Nome da classe</span>
            <Input
              value={config.name}
              placeholder="Ex.: Espadachim Arcano"
              onChange={(event) => patch({ name: event.target.value })}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Dado de vida</span>
            <Select
              value={config.hitDie}
              onChange={(event) => patch({ hitDie: event.target.value as DieSides })}
            >
              {HIT_DICE.map((die) => (
                <option key={die} value={die}>{die}</option>
              ))}
            </Select>
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Perícias de classe</span>
            <Input
              type="number"
              min={0}
              max={18}
              value={config.skillChoices}
              onChange={(event) =>
                patch({
                  skillChoices: Math.max(
                    0,
                    Math.min(18, Math.trunc(Number(event.target.value) || 0)),
                  ),
                })
              }
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-textH">Tipo de conjurador</span>
            <Select
              value={config.casterType}
              onChange={(event) =>
                patch({ casterType: event.target.value as CustomCasterType })
              }
            >
              <option value="none">Não conjurador</option>
              <option value="full">Conjurador completo</option>
              <option value="half">Meio conjurador</option>
              <option value="third">Um terço de conjurador</option>
            </Select>
          </label>

          {config.casterType !== "none" ? (
            <>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-textH">Atributo de conjuração</span>
                <Select
                  value={config.castingAttribute}
                  onChange={(event) =>
                    patch({ castingAttribute: event.target.value as Attribute })
                  }
                >
                  {ATTRIBUTE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </label>

              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-medium text-textH">Modelo de magias</span>
                <Select
                  value={config.knownSpellMode}
                  onChange={(event) =>
                    patch({ knownSpellMode: event.target.value as KnownSpellMode })
                  }
                >
                  <option value="limited">Magias conhecidas</option>
                  <option value="spellbook">Livro de magias</option>
                  <option value="prepared-only">Somente preparadas</option>
                </Select>
              </label>

              {config.knownSpellMode !== "prepared-only" ? (
                <>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">Magias conhecidas no nível 1</span>
                    <Input
                      type="number"
                      min={0}
                      value={config.knownAtLevel1}
                      onChange={(event) =>
                        patch({ knownAtLevel1: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })
                      }
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-textH">Magias adicionais por nível</span>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={config.knownPerLevel}
                      onChange={(event) =>
                        patch({ knownPerLevel: Math.max(0, Number(event.target.value) || 0) })
                      }
                    />
                  </label>
                </>
              ) : null}
            </>
          ) : null}
        </div>

        <div className="mt-5 rounded-xl border border-border bg-bg-subtle p-3">
          <div className="text-xs font-semibold text-textH">
            Proficiências em testes de resistência
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ATTRIBUTE_OPTIONS.map((option) => {
              const selected = config.savingThrows.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleSavingThrow(option.value)}
                  className={
                    selected
                      ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-xs font-semibold text-textH"
                      : "rounded-lg border border-border bg-bg px-3 py-2 text-xs text-text"
                  }
                >
                  {selected ? "✓ " : ""}{option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <Button variant="primary" onClick={onClose}>
            Aplicar configuração
          </Button>
        </div>
      </div>
    </div>
  )
}
