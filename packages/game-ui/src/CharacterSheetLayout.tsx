import type { ReactNode } from "react"

export type CharacterSheetMode = "play" | "configuration"

/** Host-controlled character sheet mode and feature layout. */
export function CharacterSheetLayout({
  mode, onModeChange, play, configuration,
}: {
  mode: CharacterSheetMode
  onModeChange: (mode: CharacterSheetMode) => void
  play: ReactNode
  configuration: ReactNode
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-bg p-2 shadow-theme-sm">
        <div className="min-w-0 px-1">
          <div className="text-xs font-semibold text-textH">Visualização da ficha</div>
          <div className="text-[10px] text-textMuted">
            {mode === "play"
              ? "Use a visão de jogo para consultar e alterar o que importa durante a partida."
              : "Use a configuração para ajustar os dados estruturais da ficha."}
          </div>
        </div>
        <div className="flex shrink-0 rounded-lg border border-border bg-bg-subtle p-1">
          {([["play", "Em jogo"], ["configuration", "Configuração"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value}
              onClick={() => onModeChange(value)}
              className={mode === value
                ? "rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accentText"
                : "rounded-md px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "play" ? play : configuration}
    </div>
  )
}
