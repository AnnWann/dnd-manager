import {
  Archive,
  Check,
  ClipboardCopy,
  FileJson,
  LoaderCircle,
  Upload,
} from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "../../components/ui/Button"
import type { CompendiumCreature } from "../../models/creatures/CompendiumCreature"
import {
  downloadCreaturePackJson,
  downloadCreaturePackZip,
  getCreatureJsonTemplate,
  importCreatureFiles,
} from "./creatureCompendiumIO"

type CreatureCompendiumTransferBarProps = {
  creatures: CompendiumCreature[]
  onImport: (creatures: CompendiumCreature[]) => void
}

type TransferStatus = {
  message: string
  warnings: string[]
}

export function CreatureCompendiumTransferBar({
  creatures,
  onImport,
}: CreatureCompendiumTransferBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<"import" | "zip">()
  const [copied, setCopied] = useState(false)
  const [status, setStatus] = useState<TransferStatus>()

  async function handleImport(files: FileList | null) {
    if (!files?.length) return

    setBusy("import")
    setStatus(undefined)

    try {
      const existingIds = new Set(creatures.map((creature) => creature.id))
      const result = await importCreatureFiles([...files])
      const added = result.creatures.filter(
        (creature) => !existingIds.has(creature.id),
      ).length
      const updated = result.creatures.length - added

      if (result.creatures.length > 0) onImport(result.creatures)

      setStatus({
        message:
          result.creatures.length > 0
            ? `${result.creatures.length} criatura(s) importada(s): ${added} nova(s) e ${updated} atualizada(s).`
            : "Nenhuma criatura válida foi encontrada.",
        warnings: result.warnings,
      })
    } catch (error) {
      setStatus({
        message: "A importação não pôde ser concluída.",
        warnings: [errorMessage(error)],
      })
    } finally {
      setBusy(undefined)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleZipExport() {
    setBusy("zip")
    setStatus(undefined)

    try {
      const warnings = await downloadCreaturePackZip(creatures)
      setStatus({
        message: `Pack ZIP exportado com ${creatures.length} criatura(s).`,
        warnings,
      })
    } catch (error) {
      setStatus({
        message: "O pack ZIP não pôde ser exportado.",
        warnings: [errorMessage(error)],
      })
    } finally {
      setBusy(undefined)
    }
  }

  async function copyStructure() {
    try {
      await navigator.clipboard.writeText(getCreatureJsonTemplate())
      setCopied(true)
      setStatus({
        message:
          "Estrutura JSON copiada. Ela pode ser preenchida manualmente ou enviada a uma IA junto do PDF.",
        warnings: [],
      })
      window.setTimeout(() => setCopied(false), 1800)
    } catch (error) {
      setStatus({
        message: "Não foi possível copiar a estrutura JSON.",
        warnings: [errorMessage(error)],
      })
    }
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
        multiple
        className="sr-only"
        onChange={(event) => void handleImport(event.target.files)}
      />

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-textH">
            Biblioteca portátil
          </h2>
          <p className="mt-1 text-xs text-textMuted">
            Importe criaturas, compartilhe packs e mantenha cópias em pastas,
            pendrives ou serviços de nuvem.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={Boolean(busy)}
          >
            {busy === "import" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Importar JSON/ZIP
          </Button>

          <Button
            onClick={() => downloadCreaturePackJson(creatures)}
            disabled={creatures.length === 0 || Boolean(busy)}
          >
            <FileJson className="h-4 w-4" />
            Exportar JSON
          </Button>

          <Button
            onClick={() => void handleZipExport()}
            disabled={creatures.length === 0 || Boolean(busy)}
          >
            {busy === "zip" ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
            Exportar ZIP
          </Button>

          <Button onClick={() => void copyStructure()} disabled={Boolean(busy)}>
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <ClipboardCopy className="h-4 w-4" />
            )}
            {copied ? "Copiado" : "Copiar estrutura"}
          </Button>
        </div>
      </div>

      {status ? (
        <div className="mt-3 rounded-lg border border-border bg-bg-subtle px-3 py-2 text-xs text-text">
          <div>{status.message}</div>
          {status.warnings.length > 0 ? (
            <details className="mt-2">
              <summary className="cursor-pointer font-medium text-textH">
                {status.warnings.length} aviso(s)
              </summary>
              <ul className="mt-2 grid gap-1 pl-4 text-textMuted">
                {status.warnings.map((warning, index) => (
                  <li key={`${warning}-${index}`} className="list-disc">
                    {warning}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Erro desconhecido."
}
