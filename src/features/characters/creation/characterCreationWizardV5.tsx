import { Component, useEffect, type ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import { confirmAndResetLocalAppData } from "../../../lib/resetLocalAppData"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Player } from "../../../models/player/Player"
import type { ClassName } from "../../../models/sheet/Class"
import { CharacterCreationWizard as BaseCharacterCreationWizard } from "./characterCreationWizardV4"
import "./characterCreationWizardMobileFix.css"

export type CharacterCreationProgressionPlan = {
  className: ClassName
  targetLevel: number
}

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

          <div className="mt-4 rounded-lg border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
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
  useEffect(() => {
    if (!props.open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [props.open])

  const { onCreate, ...baseProps } = props

  return (
    <CharacterCreationErrorBoundary open={props.open} onClose={props.onClose}>
      <BaseCharacterCreationWizard
        {...baseProps}
        onCreate={(configuredCharacter) => {
          const initialClass = configuredCharacter.get("sheet").classes?.[0]

          if (!initialClass) {
            throw new Error(
              "A criação não definiu uma classe inicial válida.",
            )
          }

          const targetLevel = Math.max(
            1,
            Math.min(20, Math.trunc(Number(initialClass.level) || 1)),
          )

          onCreate(configuredCharacter, {
            className: initialClass.className,
            targetLevel,
          })
        }}
      />
    </CharacterCreationErrorBoundary>
  )
}
