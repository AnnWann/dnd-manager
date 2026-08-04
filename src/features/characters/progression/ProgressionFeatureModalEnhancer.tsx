import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Check, Minus, Plus, X } from "lucide-react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import { Textarea } from "../../../components/ui/Textarea"
import type {
  AbilityActionKind,
  AbilityEffectDuration,
  Usage,
} from "../../../models/abilities/Ability"
import { getProgressionChoiceDescription } from "../../../models/leveling/ProgressionChoiceDescriptions"
import {
  DEFAULT_FEATS,
  encodeAsiAttributeSelection,
  encodeAsiFeatSelection,
  encodeCustomAsiFeatSelection,
  parseAsiSelection,
  type AsiAttributeIncrease,
} from "../../../models/leveling/ProgressionFeatureFinalization"
import type { Attribute } from "../../../models/sheet/Attribute"
import "./progressionFeatureModal.css"

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  str: "Força",
  dex: "Destreza",
  con: "Constituição",
  int: "Inteligência",
  wis: "Sabedoria",
  cha: "Carisma",
}

const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTE_LABELS) as Attribute[]

type FeatureChoiceProxy = {
  label: string
  count: number
  optionButtons: HTMLButtonElement[]
  customInput?: HTMLInputElement
}

type FeatureCardProxy = {
  element: HTMLElement
  name: string
  description: string
  level?: string
  source?: string
  optional: boolean
  choice?: FeatureChoiceProxy
}

type AsiMode = "attributes" | "feat"
type CustomFeatKind = "active" | "passive"

type AsiDraft = {
  mode: AsiMode
  increases: Partial<Record<Attribute, number>>
  featId: string
  customFeat: boolean
  customName: string
  customDescription: string
  customKind: CustomFeatKind
  customActionKind: AbilityActionKind
  customEffectDuration: AbilityEffectDuration
  customEffectDurationText: string
  customTrigger: string
  customUsageEnabled: boolean
  customUsageMax: string
  customUsageReset: Usage["reset"]
}

export function ProgressionFeatureModalEnhancer() {
  const [card, setCard] = useState<FeatureCardProxy | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [asiDraft, setAsiDraft] = useState<AsiDraft>(emptyAsiDraft)
  const [validationMessage, setValidationMessage] = useState("")

  useEffect(() => {
    if (typeof document === "undefined") return

    let frame = 0
    const scan = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(enhanceFeatureCards)
    }

    scan()
    const observer = new MutationObserver(scan)
    observer.observe(document.body, { childList: true, subtree: true })

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest("[data-progression-feature-modal]")) return
      if (
        target.closest(
          "button, input, select, textarea, label, summary, a, [role='button']",
        )
      ) {
        return
      }

      const article = target.closest<HTMLElement>(
        "article.progression-feature-card-enhanced",
      )
      if (!article) return
      const parsed = parseFeatureCard(article)
      if (!parsed) return

      setValidationMessage("")
      setCard(parsed)
      setAsiDraft(createAsiDraft(parsed))
    }

    document.addEventListener("click", onClick)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener("click", onClick)
      document
        .querySelectorAll(".progression-feature-card-enhanced")
        .forEach((element) =>
          element.classList.remove("progression-feature-card-enhanced"),
        )
      document
        .querySelectorAll(".progression-feature-inline-hidden")
        .forEach((element) =>
          element.classList.remove("progression-feature-inline-hidden"),
        )
    }
  }, [])

  useEffect(() => {
    if (!card) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCard(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [card])

  const currentCard = useMemo(() => {
    void refreshToken
    if (!card) return null
    if (card.element.isConnected) {
      return parseFeatureCard(card.element) ?? card
    }
    return findReplacementCard(card) ?? card
  }, [card, refreshToken])

  if (!currentCard || typeof document === "undefined") return null

  const isAsi = isAsiFeature(currentCard.name)
  const totalIncrease = ATTRIBUTE_KEYS.reduce(
    (sum, attribute) => sum + (asiDraft.increases[attribute] ?? 0),
    0,
  )

  function close() {
    setValidationMessage("")
    setCard(null)
  }

  function refresh() {
    window.setTimeout(() => setRefreshToken((value) => value + 1), 0)
  }

  function chooseProxyOption(button: HTMLButtonElement) {
    button.click()
    refresh()
  }

  function setCustomChoice(value: string) {
    const input = currentCard?.choice?.customInput
    if (!input) return
    setNativeInputValue(input, value)
    refresh()
  }

  function changeAttribute(attribute: Attribute, delta: -1 | 1) {
    setAsiDraft((current) => {
      const currentValue = current.increases[attribute] ?? 0
      const currentTotal = ATTRIBUTE_KEYS.reduce(
        (sum, key) => sum + (current.increases[key] ?? 0),
        0,
      )
      if (delta > 0 && (currentValue >= 2 || currentTotal >= 2)) return current
      if (delta < 0 && currentValue <= 0) return current
      return {
        ...current,
        increases: {
          ...current.increases,
          [attribute]: currentValue + delta,
        },
      }
    })
  }

  function confirmAsi() {
    const input = currentCard?.choice?.customInput
    if (!input) {
      setValidationMessage(
        "A característica não expôs um campo de escolha para registrar o ASI.",
      )
      return
    }

    if (asiDraft.mode === "attributes") {
      if (totalIncrease !== 2) {
        setValidationMessage(
          "Distribua exatamente 2 pontos entre os atributos, com no máximo 2 pontos no mesmo atributo.",
        )
        return
      }
      const increases = ATTRIBUTE_KEYS.flatMap((attribute) => {
        const amount = asiDraft.increases[attribute] ?? 0
        return amount === 1 || amount === 2
          ? [{ attribute, amount } as AsiAttributeIncrease]
          : []
      })
      setNativeInputValue(input, encodeAsiAttributeSelection(increases))
      close()
      return
    }

    if (asiDraft.customFeat) {
      if (!asiDraft.customName.trim()) {
        setValidationMessage("Informe o nome do talento personalizado.")
        return
      }
      if (
        asiDraft.customKind === "active" &&
        asiDraft.customUsageEnabled &&
        Math.trunc(Number(asiDraft.customUsageMax)) < 1 &&
        asiDraft.customUsageReset !== "spellSlot"
      ) {
        setValidationMessage(
          "Informe ao menos 1 uso para um talento ativo com usos limitados.",
        )
        return
      }

      const usage =
        asiDraft.customKind === "active" && asiDraft.customUsageEnabled
          ? {
              max:
                asiDraft.customUsageReset === "spellSlot"
                  ? 1
                  : Math.max(
                      1,
                      Math.trunc(Number(asiDraft.customUsageMax) || 1),
                    ),
              used: 0,
              reset: asiDraft.customUsageReset,
            }
          : undefined
      setNativeInputValue(
        input,
        encodeCustomAsiFeatSelection(
          asiDraft.customName,
          asiDraft.customDescription,
          {
            kind: asiDraft.customKind,
            actionKind:
              asiDraft.customKind === "active"
                ? asiDraft.customActionKind
                : undefined,
            usage,
            effectDuration:
              asiDraft.customKind === "active"
                ? asiDraft.customEffectDuration
                : "lasting",
            effectDurationText:
              asiDraft.customKind === "active" &&
              asiDraft.customEffectDuration === "lasting"
                ? asiDraft.customEffectDurationText
                : undefined,
            trigger:
              asiDraft.customTrigger.trim() ||
              (asiDraft.customKind === "passive" ? "always" : undefined),
          },
        ),
      )
      close()
      return
    }

    if (!asiDraft.featId) {
      setValidationMessage("Selecione um talento da lista.")
      return
    }
    setNativeInputValue(input, encodeAsiFeatSelection(asiDraft.featId))
    close()
  }

  return createPortal(
    <div
      data-progression-feature-modal
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${currentCard.name}`}
      onMouseDown={close}
    >
      <section
        className="grid max-h-[92dvh] w-full max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-2xl border border-border bg-bg-elevated shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border p-4 sm:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-textH">
                {currentCard.name}
              </h2>
              {currentCard.level ? <Badge>{currentCard.level}</Badge> : null}
              {currentCard.source ? <Badge>{currentCard.source}</Badge> : null}
              {currentCard.optional ? <Badge>Opcional</Badge> : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-textMuted">
              A descrição e as escolhas desta característica são exibidas neste modal. As seleções são registradas diretamente no wizard.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={close}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-textMuted hover:bg-bg-subtle hover:text-textH"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <main className="min-h-0 overflow-y-auto p-4 sm:p-5">
          <section className="rounded-xl border border-border bg-bg-subtle p-4">
            <h3 className="text-sm font-semibold text-textH">Descrição</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-textMuted">
              {currentCard.description || "Sem descrição cadastrada."}
            </p>
          </section>

          {isAsi ? (
            <section className="mt-4 grid gap-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg-subtle p-2">
                <button
                  type="button"
                  onClick={() =>
                    setAsiDraft((current) => ({
                      ...current,
                      mode: "attributes",
                    }))
                  }
                  className={
                    asiDraft.mode === "attributes"
                      ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm font-semibold text-textH"
                      : "rounded-lg px-3 py-2 text-sm text-textMuted hover:bg-bg"
                  }
                >
                  Aumentar atributos
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAsiDraft((current) => ({ ...current, mode: "feat" }))
                  }
                  className={
                    asiDraft.mode === "feat"
                      ? "rounded-lg border border-accentBorder bg-accentBg px-3 py-2 text-sm font-semibold text-textH"
                      : "rounded-lg px-3 py-2 text-sm text-textMuted hover:bg-bg"
                  }
                >
                  Escolher talento
                </button>
              </div>

              {asiDraft.mode === "attributes" ? (
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-textH">
                        Distribuição do ASI
                      </h3>
                      <p className="mt-1 text-xs text-textMuted">
                        Distribua exatamente 2 pontos. Um único atributo pode receber os dois pontos.
                      </p>
                    </div>
                    <Badge>{totalIncrease}/2 pontos</Badge>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {ATTRIBUTE_KEYS.map((attribute) => {
                      const amount = asiDraft.increases[attribute] ?? 0
                      return (
                        <div
                          key={attribute}
                          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg p-3"
                        >
                          <span className="text-sm font-medium text-textH">
                            {ATTRIBUTE_LABELS[attribute]}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={amount <= 0}
                              onClick={() => changeAttribute(attribute, -1)}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold text-textH">
                              +{amount}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={amount >= 2 || totalIncrease >= 2}
                              onClick={() => changeAttribute(attribute, 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="grid gap-4">
                  <label className="flex items-center gap-2 rounded-xl border border-border bg-bg p-3 text-sm text-text">
                    <input
                      type="checkbox"
                      checked={asiDraft.customFeat}
                      onChange={(event) =>
                        setAsiDraft((current) => ({
                          ...current,
                          customFeat: event.target.checked,
                        }))
                      }
                    />
                    Criar um talento personalizado como habilidade
                  </label>

                  {asiDraft.customFeat ? (
                    <div className="grid gap-4 rounded-xl border border-border bg-bg-subtle p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="grid gap-1.5 text-xs text-text">
                          Nome do talento
                          <Input
                            value={asiDraft.customName}
                            placeholder="Nome do talento"
                            onChange={(event) =>
                              setAsiDraft((current) => ({
                                ...current,
                                customName: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs text-text">
                          Tipo de habilidade
                          <Select
                            value={asiDraft.customKind}
                            onChange={(event) =>
                              setAsiDraft((current) => ({
                                ...current,
                                customKind: event.target.value as CustomFeatKind,
                              }))
                            }
                          >
                            <option value="passive">Passiva</option>
                            <option value="active">Ativa</option>
                          </Select>
                        </label>
                      </div>

                      <label className="grid gap-1.5 text-xs text-text">
                        Descrição e efeitos
                        <Textarea
                          value={asiDraft.customDescription}
                          placeholder="Descreva benefícios, condições e limitações."
                          onChange={(event) =>
                            setAsiDraft((current) => ({
                              ...current,
                              customDescription: event.target.value,
                            }))
                          }
                        />
                      </label>

                      {asiDraft.customKind === "active" ? (
                        <div className="grid gap-4 rounded-xl border border-border bg-bg p-4">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1.5 text-xs text-text">
                              Tipo de ação
                              <Select
                                value={asiDraft.customActionKind}
                                onChange={(event) =>
                                  setAsiDraft((current) => ({
                                    ...current,
                                    customActionKind: event.target
                                      .value as AbilityActionKind,
                                  }))
                                }
                              >
                                <option value="action">Ação</option>
                                <option value="bonusAction">Ação bônus</option>
                                <option value="reaction">Reação</option>
                                <option value="free">Sem ação</option>
                              </Select>
                            </label>
                            <label className="grid gap-1.5 text-xs text-text">
                              Duração do efeito
                              <Select
                                value={asiDraft.customEffectDuration}
                                onChange={(event) =>
                                  setAsiDraft((current) => ({
                                    ...current,
                                    customEffectDuration: event.target
                                      .value as AbilityEffectDuration,
                                  }))
                                }
                              >
                                <option value="instant">Instantâneo</option>
                                <option value="lasting">Duradouro</option>
                              </Select>
                            </label>
                          </div>

                          {asiDraft.customEffectDuration === "lasting" ? (
                            <label className="grid gap-1.5 text-xs text-text">
                              Duração narrativa
                              <Input
                                value={asiDraft.customEffectDurationText}
                                placeholder="Ex.: por 1 minuto"
                                onChange={(event) =>
                                  setAsiDraft((current) => ({
                                    ...current,
                                    customEffectDurationText:
                                      event.target.value,
                                  }))
                                }
                              />
                            </label>
                          ) : null}

                          <label className="grid gap-1.5 text-xs text-text">
                            Gatilho opcional
                            <Input
                              value={asiDraft.customTrigger}
                              placeholder="Ex.: ao acertar um ataque"
                              onChange={(event) =>
                                setAsiDraft((current) => ({
                                  ...current,
                                  customTrigger: event.target.value,
                                }))
                              }
                            />
                          </label>

                          <label className="flex items-center gap-2 text-xs text-text">
                            <input
                              type="checkbox"
                              checked={asiDraft.customUsageEnabled}
                              onChange={(event) =>
                                setAsiDraft((current) => ({
                                  ...current,
                                  customUsageEnabled: event.target.checked,
                                }))
                              }
                            />
                            Possui quantidade limitada de usos
                          </label>

                          {asiDraft.customUsageEnabled ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="grid gap-1.5 text-xs text-text">
                                Usos máximos
                                <Input
                                  type="number"
                                  min={1}
                                  value={asiDraft.customUsageMax}
                                  disabled={
                                    asiDraft.customUsageReset === "spellSlot"
                                  }
                                  onChange={(event) =>
                                    setAsiDraft((current) => ({
                                      ...current,
                                      customUsageMax: event.target.value,
                                    }))
                                  }
                                />
                              </label>
                              <label className="grid gap-1.5 text-xs text-text">
                                Recuperação
                                <Select
                                  value={asiDraft.customUsageReset}
                                  onChange={(event) =>
                                    setAsiDraft((current) => ({
                                      ...current,
                                      customUsageReset: event.target
                                        .value as Usage["reset"],
                                    }))
                                  }
                                >
                                  <option value="turn">A cada turno</option>
                                  <option value="shortRest">Descanso curto</option>
                                  <option value="longRest">Descanso longo</option>
                                  <option value="limited">Não recupera automaticamente</option>
                                  <option value="spellSlot">Gasta espaço de magia</option>
                                </Select>
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <label className="grid gap-1.5 text-xs text-text">
                          Gatilho ou condição passiva
                          <Input
                            value={asiDraft.customTrigger}
                            placeholder="Ex.: sempre, ao atacar, ao realizar um teste"
                            onChange={(event) =>
                              setAsiDraft((current) => ({
                                ...current,
                                customTrigger: event.target.value,
                              }))
                            }
                          />
                        </label>
                      )}
                    </div>
                  ) : (
                    <div className="grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {DEFAULT_FEATS.map((feat) => {
                        const selected = asiDraft.featId === feat.id
                        return (
                          <button
                            key={feat.id}
                            type="button"
                            onClick={() =>
                              setAsiDraft((current) => ({
                                ...current,
                                featId: feat.id,
                              }))
                            }
                            className={
                              selected
                                ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                                : "rounded-xl border border-border bg-bg p-4 text-left hover:border-accentBorder"
                            }
                          >
                            <div className="flex items-start justify-between gap-2">
                              <strong className="text-sm text-textH">
                                {feat.name}
                              </strong>
                              {selected ? (
                                <Check className="h-4 w-4 shrink-0 text-textH" />
                              ) : null}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-textMuted">
                              {feat.description}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Badge>
                                {feat.kind === "active" ? "Ativo" : "Passivo"}
                              </Badge>
                              {feat.actionKind ? (
                                <Badge>{actionLabel(feat.actionKind)}</Badge>
                              ) : null}
                              {feat.usage ? (
                                <Badge>
                                  {feat.usage.max} uso(s) · {resetLabel(feat.usage.reset)}
                                </Badge>
                              ) : null}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          ) : currentCard.choice ? (
            <section className="mt-4 grid gap-3">
              <div>
                <h3 className="text-sm font-semibold text-textH">
                  {currentCard.choice.label}
                </h3>
                <p className="mt-1 text-xs text-textMuted">
                  Escolha {currentCard.choice.count}. As opções selecionadas ficam destacadas.
                </p>
              </div>

              {currentCard.choice.optionButtons.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {currentCard.choice.optionButtons.map((button, index) => {
                    const label =
                      button.textContent?.trim() || `Opção ${index + 1}`
                    const selected = isProxyButtonSelected(button)
                    return (
                      <button
                        key={`${label}:${index}`}
                        type="button"
                        onClick={() => chooseProxyOption(button)}
                        className={
                          selected
                            ? "rounded-xl border border-accentBorder bg-accentBg p-4 text-left"
                            : "rounded-xl border border-border bg-bg p-4 text-left hover:border-accentBorder"
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <strong className="text-sm text-textH">{label}</strong>
                          {selected ? (
                            <Check className="h-4 w-4 shrink-0 text-textH" />
                          ) : null}
                        </div>
                        <p className="mt-2 text-xs leading-5 text-textMuted">
                          {getProgressionChoiceDescription(
                            label,
                            currentCard.choice?.label,
                          )}
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : null}

              {currentCard.choice.customInput ? (
                <label className="grid gap-1.5 text-xs text-text">
                  Escolha personalizada
                  <Input
                    value={currentCard.choice.customInput.value}
                    placeholder="Digite a escolha"
                    onChange={(event) => setCustomChoice(event.target.value)}
                  />
                </label>
              ) : null}
            </section>
          ) : null}

          {validationMessage ? (
            <div className="mt-4 rounded-xl border border-danger bg-dangerBg p-3 text-sm text-danger">
              {validationMessage}
            </div>
          ) : null}
        </main>

        <footer className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end sm:p-5">
          <Button variant="secondary" onClick={close}>
            Fechar
          </Button>
          {isAsi ? (
            <Button onClick={confirmAsi}>
              <Check className="h-4 w-4" />
              Confirmar ASI
            </Button>
          ) : null}
        </footer>
      </section>
    </div>,
    document.body,
  )
}

function enhanceFeatureCards() {
  document.querySelectorAll<HTMLElement>("article").forEach((article) => {
    if (article.closest("[data-progression-feature-modal]")) return
    if (!looksLikeFeatureCard(article)) return

    article.classList.add("progression-feature-card-enhanced")
    const details = Array.from(article.querySelectorAll("details")).find(
      (entry) =>
        normalizeText(entry.querySelector("summary")?.textContent ?? "").includes(
          "ler detalhes da caracteristica",
        ),
    )
    if (details) details.classList.add("progression-feature-inline-hidden")

    if (!details) {
      const heading = article.querySelector("h3")
      const description = heading
        ?.closest("div")
        ?.querySelector<HTMLElement>("p")
      if (description) {
        description.classList.add("progression-feature-inline-hidden")
      }
    }

    const choiceBlock = findChoiceBlock(article)
    if (choiceBlock) {
      choiceBlock.classList.add("progression-feature-inline-hidden")
    }
  })
}

function looksLikeFeatureCard(article: HTMLElement): boolean {
  const detailsSummary = Array.from(article.querySelectorAll("summary")).some(
    (summary) =>
      normalizeText(summary.textContent ?? "").includes(
        "ler detalhes da caracteristica",
      ),
  )
  if (detailsSummary) return true

  const heading = article.querySelector("h3")
  if (!heading?.textContent?.trim()) return false
  const text = normalizeText(article.textContent ?? "")
  return text.includes("nivel") && !text.includes("preparar esta magia")
}

function parseFeatureCard(article: HTMLElement): FeatureCardProxy | undefined {
  const heading = article.querySelector("h3")
  const detail = Array.from(article.querySelectorAll("details")).find((entry) =>
    normalizeText(entry.querySelector("summary")?.textContent ?? "").includes(
      "ler detalhes da caracteristica",
    ),
  )
  const strong = article.querySelector("strong")
  const name = heading?.textContent?.trim() || strong?.textContent?.trim()
  if (!name) return undefined

  const description =
    detail?.querySelector("p")?.textContent?.trim() ||
    heading?.closest("div")?.querySelector("p")?.textContent?.trim() ||
    ""
  const badges = Array.from(article.querySelectorAll("span"))
    .map((entry) => entry.textContent?.trim() ?? "")
    .filter(Boolean)
  const level = badges.find((label) => /^Nível\s+\d+/i.test(label))
  const source = badges.find((label) =>
    ["PHB", "XGE", "TCE", "SCAG", "DMG", "ERLW", "EGW"].includes(label),
  )
  const optional = badges.some((label) => normalizeText(label) === "opcional")
  const choiceBlock = findChoiceBlock(article)
  const choice = choiceBlock ? parseChoiceBlock(choiceBlock) : undefined

  return {
    element: article,
    name,
    description,
    level,
    source,
    optional,
    choice,
  }
}

function findChoiceBlock(article: HTMLElement): HTMLElement | undefined {
  const candidates = Array.from(article.querySelectorAll<HTMLElement>("div"))
    .filter((element) => {
      const text = normalizeText(element.textContent ?? "")
      return (
        text.includes("escolha") &&
        Boolean(element.querySelector("button, input"))
      )
    })
    .toSorted((left, right) => elementDepth(right) - elementDepth(left))

  return candidates[0]
}

function parseChoiceBlock(block: HTMLElement): FeatureChoiceProxy | undefined {
  const text = block.textContent?.trim() ?? ""
  const match = text.match(/(.+?)\s*[·-]\s*escolha\s+(\d+)/i)
  const label = match?.[1]?.trim() || "Escolhas da característica"
  const count = Math.max(1, Number(match?.[2]) || 1)
  const optionButtons = Array.from(
    block.querySelectorAll<HTMLButtonElement>("button"),
  ).filter((button) => {
    const value = normalizeText(button.textContent ?? "")
    return ![
      "incluida",
      "incluir",
      "editar",
      "remover",
      "habilidade personalizada",
    ].includes(value)
  })
  const customInput = block.querySelector<HTMLInputElement>("input") ?? undefined

  if (!optionButtons.length && !customInput) return undefined
  return { label, count, optionButtons, customInput }
}

function findReplacementCard(
  previous: FeatureCardProxy,
): FeatureCardProxy | undefined {
  const normalizedName = normalizeText(previous.name)
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "article.progression-feature-card-enhanced",
    ),
  )
  for (const candidate of candidates) {
    const parsed = parseFeatureCard(candidate)
    if (
      parsed &&
      normalizeText(parsed.name) === normalizedName &&
      parsed.level === previous.level
    ) {
      return parsed
    }
  }
  return undefined
}

function createAsiDraft(card: FeatureCardProxy): AsiDraft {
  const parsed = parseAsiSelection(card.choice?.customInput?.value)
  if (parsed?.mode === "attributes") {
    return {
      ...emptyAsiDraft(),
      mode: "attributes",
      increases: Object.fromEntries(
        parsed.increases.map((entry) => [entry.attribute, entry.amount]),
      ),
    }
  }
  if (parsed?.mode === "feat") {
    return {
      ...emptyAsiDraft(),
      mode: "feat",
      featId: parsed.featId,
    }
  }
  if (parsed?.mode === "customFeat") {
    return {
      ...emptyAsiDraft(),
      mode: "feat",
      customFeat: true,
      customName: parsed.feat.name,
      customDescription: parsed.feat.description,
      customKind: parsed.feat.kind,
      customActionKind: parsed.feat.actionKind ?? "action",
      customEffectDuration:
        parsed.feat.effectDuration ??
        (parsed.feat.kind === "active" ? "instant" : "lasting"),
      customEffectDurationText: parsed.feat.effectDurationText ?? "",
      customTrigger: parsed.feat.trigger ?? "",
      customUsageEnabled: Boolean(parsed.feat.usage),
      customUsageMax: String(parsed.feat.usage?.max ?? 1),
      customUsageReset: parsed.feat.usage?.reset ?? "longRest",
    }
  }
  return emptyAsiDraft()
}

function emptyAsiDraft(): AsiDraft {
  return {
    mode: "attributes",
    increases: {},
    featId: "",
    customFeat: false,
    customName: "",
    customDescription: "",
    customKind: "passive",
    customActionKind: "action",
    customEffectDuration: "instant",
    customEffectDurationText: "",
    customTrigger: "",
    customUsageEnabled: false,
    customUsageMax: "1",
    customUsageReset: "longRest",
  }
}

function isAsiFeature(name: string): boolean {
  const normalized = normalizeText(name)
  return (
    normalized.includes("aprimoramento de atributo") ||
    normalized.includes("ability score improvement")
  )
}

function isProxyButtonSelected(button: HTMLButtonElement): boolean {
  return (
    button.className.includes("accentBorder") ||
    button.className.includes("accentBg") ||
    button.getAttribute("aria-pressed") === "true"
  )
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value",
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
  input.dispatchEvent(new Event("change", { bubbles: true }))
}

function elementDepth(element: Element): number {
  let depth = 0
  let current: Element | null = element
  while (current) {
    depth += 1
    current = current.parentElement
  }
  return depth
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function actionLabel(value: string): string {
  const labels: Record<string, string> = {
    action: "Ação",
    bonusAction: "Ação bônus",
    reaction: "Reação",
    free: "Sem ação",
  }
  return labels[value] ?? value
}

function resetLabel(value: string): string {
  const labels: Record<string, string> = {
    turn: "por turno",
    cooldown: "recarga",
    shortRest: "descanso curto",
    longRest: "descanso longo",
    limited: "limitado",
    spellSlot: "espaço de magia",
  }
  return labels[value] ?? value
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-accentBorder bg-accentBg px-2 py-0.5 text-[10px] text-textH">
      {children}
    </span>
  )
}
