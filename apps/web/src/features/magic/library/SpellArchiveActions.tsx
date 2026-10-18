import { FileArchive, FileUp } from "lucide-react"
import { useRef, useState, type ReactNode } from "react"

import { Button } from "../../../components/ui/Button"
import type { Spell } from "../../../models/magic/spells/Spell"
import {
  createHomebrewSpellZip,
  downloadBlob,
  readHomebrewSpellFile,
} from "./spellArchive"

type Props = {
  spells: Spell[]
  onImport: (spells: Spell[]) => void | Promise<void>
  exportName: string
  children?: ReactNode
}

export function SpellArchiveActions({
  spells,
  onImport,
  exportName,
  children,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState("")

  const homebrew = spells.filter((spell) => spell.homebrew)

  async function exportArchive() {
    if (!homebrew.length || working) return
    setWorking(true)
    setMessage("")
    try {
      const blob = await createHomebrewSpellZip(homebrew)
      downloadBlob(blob, `${exportName}.zip`)
      setMessage(`${homebrew.length} magia(s) exportada(s).`)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível exportar as magias.",
      )
    } finally {
      setWorking(false)
    }
  }

  async function importArchive(file: File | undefined) {
    if (!file || working) return
    setWorking(true)
    setMessage("")
    try {
      const imported = await readHomebrewSpellFile(file)
      await onImport(imported)
      setMessage(`${imported.length} magia(s) importada(s).`)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível importar as magias.",
      )
    } finally {
      setWorking(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-3 shadow-theme-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={working || !homebrew.length}
          onClick={() => void exportArchive()}
        >
          <FileArchive className="h-4 w-4" />
          Exportar ZIP
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={working}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          Importar ZIP/JSON
        </Button>
        {children}
      </div>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".zip,.json,application/zip,application/json"
        onChange={(event) => void importArchive(event.target.files?.[0])}
      />

      {message ? (
        <p className="mt-2 text-xs text-textMuted">{message}</p>
      ) : null}
    </section>
  )
}
