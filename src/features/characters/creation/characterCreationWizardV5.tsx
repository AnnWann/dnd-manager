import {
  Component,
  useEffect,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react"

import { Button } from "../../../components/ui/Button"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import type { Player } from "../../../models/player/Player"
import { CharacterCreationWizard as BaseCharacterCreationWizard } from "./characterCreationWizardV4"
import "./characterCreationWizardMobileFix.css"

type Props = {
  open: boolean
  defaultOwner: Player
  owners: Player[]
  canAssignOwners: boolean
  onClose: () => void
  onCreate: (character: CharacterTemplate) => void
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
            O criador encontrou um erro neste dispositivo. Feche e abra novamente;
            seus dados sincronizados não foram alterados.
          </p>
          <details className="mt-3 rounded-lg border border-border bg-bg-subtle p-3 text-xs text-textMuted">
            <summary className="cursor-pointer font-medium text-textH">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px]">
              {this.state.error.message || "Erro desconhecido"}
            </pre>
          </details>
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                this.setState({ error: null })
                this.props.onClose()
              }}
            >
              Fechar criador
            </Button>
          </div>
        </div>
      </div>
    )
  }
}

export function CharacterCreationWizard(props: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!props.open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [props.open])

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return

    const button = target.closest("button")
    const label = button?.textContent?.trim().toLocaleLowerCase("pt-BR") ?? ""
    const changesStep =
      label.includes("continuar") ||
      label.includes("voltar") ||
      /^\d+\./.test(label.replace(/^✓\s*/, ""))

    if (!changesStep) return

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement) activeElement.blur()

    window.setTimeout(() => {
      const body = rootRef.current?.querySelector(
        '[aria-labelledby="character-creation-title"] main',
      )

      if (body instanceof HTMLElement) {
        body.scrollTo({ top: 0, behavior: "auto" })
      }
    }, 0)
  }

  return (
    <CharacterCreationErrorBoundary open={props.open} onClose={props.onClose}>
      <div ref={rootRef} onClickCapture={handleClickCapture}>
        <BaseCharacterCreationWizard {...props} />
      </div>
    </CharacterCreationErrorBoundary>
  )
}
