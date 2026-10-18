import { FileUp, Upload } from "lucide-react"
import { useRef, useState } from "react"

import { importLegacyCampaign } from "../../api/legacy-campaign-import"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Textarea } from "../../components/ui/Textarea"
import { useUserData } from "../../features/user/UserDataProvider"
import {
  parseLegacyCampaignBackup,
  summarizeLegacyCampaignBackup,
  type LegacyCampaignBackupV1,
} from "../../shared/legacy/legacyCampaignBackup"

const MAX_BACKUP_BYTES = 10 * 1024 * 1024

type PendingImport = {
  fileName: string
  backup: LegacyCampaignBackupV1
}

export function LegacyCampaignImportButton() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const { refreshAll } = useUserData()
  const [pending, setPending] = useState<PendingImport | null>(null)
  const [campaignName, setCampaignName] = useState("")
  const [description, setDescription] = useState("")
  const [working, setWorking] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function selectFile(file: File) {
    setError("")
    setNotice("")

    try {
      if (file.size > MAX_BACKUP_BYTES) {
        throw new Error("O backup é maior que 10 MB.")
      }
      const parsed = parseLegacyCampaignBackup(JSON.parse(await file.text()) as unknown)
      setPending({ fileName: file.name, backup: parsed })
      setCampaignName(defaultCampaignName(file.name))
      setDescription("")
    } catch (cause) {
      setPending(null)
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível ler o backup legacy.",
      )
    } finally {
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  async function importCampaign() {
    if (!pending || !campaignName.trim() || working) return
    setWorking(true)
    setError("")
    setNotice("")

    try {
      const result = await importLegacyCampaign({
        name: campaignName.trim(),
        description: description.trim() || undefined,
        backup: pending.backup,
      })
      await refreshAll()
      setPending(null)
      setNotice(
        `Campanha “${result.campaign.name}” importada com ${result.imported.characters} personagem${result.imported.characters === 1 ? "" : "s"}.`,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível importar a campanha legacy.",
      )
    } finally {
      setWorking(false)
    }
  }

  const summary = pending ? summarizeLegacyCampaignBackup(pending.backup) : null

  return (
    <>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={working}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Importar campanha legacy
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void selectFile(file)
          }}
        />
        {notice ? <div className="max-w-md text-xs text-accent">{notice}</div> : null}
        {error && !pending ? (
          <div className="max-w-md text-xs text-danger">{error}</div>
        ) : null}
      </div>

      {pending && summary ? (
        <Modal
          title="Importar campanha legacy"
          className="max-w-2xl"
          onClose={() => {
            if (!working) {
              setPending(null)
              setError("")
            }
          }}
        >
          <div className="grid gap-4">
            <div className="rounded-xl border border-border bg-bg-subtle p-3">
              <div className="flex items-start gap-3">
                <FileUp className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-textH">
                    {pending.fileName}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-textMuted">
                    Backup reconhecido como <code>dndmm-session-backup</code> v1, formato usado pelo master legacy.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Summary label="Personagens" value={summary.characters} />
              <Summary label="Itens do grupo" value={summary.partyItems} />
              <Summary label="Itens no chão" value={summary.groundItems} />
              <Summary label="Magias" value={summary.spells} />
              <Summary label="Sistemas" value={summary.customSystems} />
              <Summary label="Missões" value={summary.missions} />
            </div>

            <label className="grid gap-1.5 text-xs font-medium text-textH">
              Nome da nova campanha
              <Input
                value={campaignName}
                maxLength={120}
                disabled={working}
                onChange={(event) => setCampaignName(event.target.value)}
              />
            </label>

            <label className="grid gap-1.5 text-xs font-medium text-textH">
              Descrição opcional
              <Textarea
                value={description}
                disabled={working}
                placeholder="Se ficar vazio, será registrada como campanha importada do sistema legacy."
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <div className="rounded-xl border border-warning bg-warningBg p-3 text-xs leading-5 text-warning">
              Os usuários do sistema legacy não correspondem automaticamente às contas atuais. Os personagens serão importados inicialmente sob a propriedade do mestre que está realizando a importação e poderão ser reatribuídos depois que os jogadores entrarem na campanha.
            </div>

            {error ? (
              <div className="rounded-xl border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="secondary"
                disabled={working}
                onClick={() => {
                  setPending(null)
                  setError("")
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={!campaignName.trim() || working}
                onClick={() => void importCampaign()}
              >
                <Upload className="h-4 w-4" />
                {working ? "Importando..." : "Importar campanha"}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-textMuted">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold text-textH">{value}</div>
    </div>
  )
}

function defaultCampaignName(fileName: string): string {
  const base = fileName.replace(/\.json$/i, "").trim()
  if (!base || /^dndmm-backup-/i.test(base)) return "Campanha importada"
  return base.slice(0, 120)
}
