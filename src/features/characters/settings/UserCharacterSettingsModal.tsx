import { Eye, EyeOff, Trash2, X } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import {
  CHARACTER_TABS,
  type CharacterTab,
} from "../characterViewTabs"

const HIDEABLE_TABS = CHARACTER_TABS.filter(
  (tab) => tab.key !== "sheet",
) as Array<(typeof CHARACTER_TABS)[number] & { key: Exclude<CharacterTab, "sheet"> }>

type Props = {
  open: boolean
  character: CharacterTemplate
  onClose: () => void
  onDelete: () => void
  updateCharacter: (
    characterId: string,
    updater: (character: CharacterTemplate) => CharacterTemplate,
  ) => void
}

export function UserCharacterSettingsModal({
  open,
  character,
  onClose,
  onDelete,
  updateCharacter,
}: Props) {
  const [name, setName] = useState(character.get("name"))
  const [visibility, setVisibility] = useState(
    character.get("visibility"),
  )

  useEffect(() => {
    if (!open) return
    setName(character.get("name"))
    setVisibility(character.get("visibility"))
  }, [character, open])

  if (!open) return null

  const hiddenTabs = new Set(
    character.get("sheet").hiddenCharacterTabs ?? [],
  )

  function saveGeneralSettings() {
    const normalizedName = name.trim()
    if (!normalizedName) return

    updateCharacter(character.get("id"), (current) =>
      current.withPatch({
        name: normalizedName,
        visibility,
      }),
    )
    onClose()
  }

  function setTabVisible(tab: CharacterTab, visible: boolean) {
    updateCharacter(character.get("id"), (current) => {
      const currentHidden = new Set(
        current.get("sheet").hiddenCharacterTabs ?? [],
      )

      if (visible) currentHidden.delete(tab)
      else currentHidden.add(tab)

      return current.withSheet(
        "hiddenCharacterTabs",
        Array.from(currentHidden),
      )
    })
  }

  function confirmDelete() {
    const confirmed = window.confirm(
      `Excluir permanentemente “${character.get("name") || "este personagem"}”?\n\n` +
        "A ficha, seus vínculos com campanhas e suas concessões de homebrew serão removidos. Esta ação não pode ser desfeita.",
    )

    if (!confirmed) return
    onDelete()
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex h-screen w-screen items-center justify-center overflow-hidden bg-black/65 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Configurações de ${character.get("name")}`}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <section className="grid max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl gap-5 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-bg-elevated p-4 shadow-theme-lg sm:max-h-[calc(100dvh-2rem)] sm:p-5">
        <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-semibold text-textH">
              Configurações do personagem
            </h2>
            <p className="mt-1 text-sm text-text">
              Edite dados gerais, organize as abas e gerencie a ficha.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border p-2 text-textH hover:bg-accentBg"
            aria-label="Fechar configurações"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="font-semibold text-textH">Dados gerais</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs text-text">
              Nome
              <Input
                value={name}
                maxLength={120}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-xs text-text">
              Visibilidade
              <select
                className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                value={visibility}
                onChange={(event) =>
                  setVisibility(
                    event.target.value as "private" | "party" | "master",
                  )
                }
              >
                <option value="private">Privado</option>
                <option value="party">Campanhas vinculadas</option>
                <option value="master">Somente mestres vinculados</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              disabled={!name.trim()}
              onClick={saveGeneralSettings}
            >
              Salvar configurações
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg p-4">
          <h3 className="font-semibold text-textH">Abas da ficha</h3>
          <p className="mt-1 text-xs text-text">
            A aba Ficha permanece sempre visível. Ocultar uma aba não apaga seus dados.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {HIDEABLE_TABS.map((tab) => {
              const visible = !hiddenTabs.has(tab.key)
              const Icon = tab.icon

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTabVisible(tab.key, !visible)}
                  className={
                    visible
                      ? "flex items-center justify-between gap-3 rounded-lg border border-accentBorder bg-accentBg px-3 py-3 text-left"
                      : "flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-subtle px-3 py-3 text-left hover:bg-bg"
                  }
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-accent" />
                    <span className="truncate text-sm font-medium text-textH">
                      {tab.label}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-text">
                    {visible ? (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Visível
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Oculta
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rounded-xl border border-danger bg-dangerBg p-4">
          <h3 className="font-semibold text-danger">Zona de perigo</h3>
          <p className="mt-1 text-xs leading-5 text-text">
            Excluir a ficha também remove seus vínculos relacionais com campanhas e magias homebrew.
          </p>
          <div className="mt-4">
            <Button variant="secondary" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" />
              Excluir personagem
            </Button>
          </div>
        </section>
      </section>
    </div>
  )
}
