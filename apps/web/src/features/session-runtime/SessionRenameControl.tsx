import { Save } from "lucide-react"
import { useEffect, useState, type FormEvent } from "react"

import {
  getSessionCreationSettings,
  updateSessionName,
} from "../../api/session-settings"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"

export function SessionRenameControl({ campaignId }: { campaignId: string }) {
  const [name, setName] = useState("")
  const [savedName, setSavedName] = useState("")
  const [canRename, setCanRename] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [noticeMessage, setNoticeMessage] = useState("")

  useEffect(() => {
    let cancelled = false

    void getSessionCreationSettings(campaignId)
      .then((settings) => {
        if (cancelled) return
        setCanRename(settings.canRenameCampaign)
        setName(settings.campaign.name)
        setSavedName(settings.campaign.name)
      })
      .catch((error) => {
        if (cancelled) return
        console.error("[session-settings] failed to load session name", error)
      })

    return () => {
      cancelled = true
    }
  }, [campaignId])

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const normalized = name.trim()
    if (!normalized || normalized === savedName || saving) return

    setSaving(true)
    setErrorMessage("")
    setNoticeMessage("")
    try {
      const updatedName = await updateSessionName(campaignId, normalized)
      setName(updatedName)
      setSavedName(updatedName)
      setNoticeMessage("Nome da sessão atualizado.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o nome da sessão.",
      )
    } finally {
      setSaving(false)
    }
  }

  if (!canRename) return null

  const normalized = name.trim()
  const dirty = Boolean(normalized && normalized !== savedName)

  return (
    <section className="mx-auto mb-5 w-full max-w-7xl rounded-xl border border-border bg-bg p-4 shadow-theme-sm sm:p-5">
      <form className="grid gap-3" onSubmit={(event) => void saveName(event)}>
        <div>
          <h2 className="font-semibold text-textH">Nome da sessão</h2>
          <p className="mt-1 text-xs text-textMuted">
            Mestres podem alterar o nome exibido para esta sessão.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="session-name"
            value={name}
            maxLength={120}
            disabled={saving}
            aria-label="Nome da sessão"
            onChange={(event) => {
              setName(event.target.value)
              setNoticeMessage("")
            }}
          />
          <Button type="submit" disabled={!dirty || saving} loading={saving}>
            <Save className="h-4 w-4" />
            Salvar nome
          </Button>
        </div>

        {errorMessage ? (
          <div className="rounded-lg border border-danger bg-dangerBg px-3 py-2 text-xs text-danger">
            {errorMessage}
          </div>
        ) : null}
        {noticeMessage ? (
          <div className="text-xs text-textMuted">{noticeMessage}</div>
        ) : null}
      </form>
    </section>
  )
}
