import { Send } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import {
  getMyCampaigns,
  type UserCampaign,
} from "../../api/user-campaigns"
import { submitOwnedHomebrewSpellToCampaign } from "../../api/user-spells"
import { Button } from "../../components/ui/Button"
import { useMagicContext } from "../../contexts/magicContext"
import { SpellArchiveActions } from "../../features/magic/library/SpellArchiveActions"
import {
  SpellLibraryView,
  type SpellLibraryRecord,
} from "../../features/magic/library/SpellLibraryView"
import { useUserMagicState } from "../../features/magic/UserMagicProvider"

export function UserSpellsTab() {
  const { records, loading, errorMessage, reload } = useUserMagicState()
  const { savedSpells, saveSpells } = useMagicContext()
  const [campaigns, setCampaigns] = useState<UserCampaign[]>([])
  const [sendOpen, setSendOpen] = useState(false)
  const [selectedSpellId, setSelectedSpellId] = useState("")
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [sending, setSending] = useState(false)
  const [sendMessage, setSendMessage] = useState("")

  const libraryRecords = useMemo<SpellLibraryRecord[]>(
    () =>
      records.map((record) => ({
        index: record.index,
        owned: record.ownedByCurrentUser,
        updatedAt: record.updatedAt,
        campaignNames: record.campaigns
          .filter((campaign) => campaign.status === "APPROVED")
          .map((campaign) => campaign.name),
        characterNames: record.characters.map((character) => character.name),
      })),
    [records],
  )

  const ownedRecords = useMemo(
    () => records.filter((record) => record.ownedByCurrentUser),
    [records],
  )
  const availableCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "ACTIVE"),
    [campaigns],
  )

  useEffect(() => {
    let cancelled = false
    void getMyCampaigns()
      .then((result) => {
        if (!cancelled) setCampaigns(result)
      })
      .catch(() => {
        if (!cancelled) setCampaigns([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  function openSendDialog() {
    setSelectedSpellId(ownedRecords[0]?.id ?? "")
    setSelectedCampaignId(availableCampaigns[0]?.id ?? "")
    setSendMessage("")
    setSendOpen(true)
  }

  async function sendToSession() {
    const record = ownedRecords.find((entry) => entry.id === selectedSpellId)
    const campaign = availableCampaigns.find(
      (entry) => entry.id === selectedCampaignId,
    )
    if (!record || !campaign || sending) return

    setSending(true)
    setSendMessage("")
    try {
      const isMaster = campaign.isOwner || campaign.role === "MASTER"
      await submitOwnedHomebrewSpellToCampaign(record, {
        id: campaign.id,
        name: campaign.name,
        autoApprove: isMaster,
      })
      await reload()
      setSendMessage(
        isMaster
          ? "Magia adicionada à sessão e aprovada automaticamente."
          : "Solicitação enviada ao mestre da sessão.",
      )
    } catch (error) {
      setSendMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a magia para a sessão.",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-4">
      <SpellArchiveActions
        spells={savedSpells}
        exportName="dndmm-homebrew-magias-user"
        onImport={(spells) => saveSpells(spells)}
      >
        <Button
          size="sm"
          variant="secondary"
          disabled={!ownedRecords.length || !availableCampaigns.length}
          onClick={openSendDialog}
        >
          <Send className="h-4 w-4" />
          Enviar para sessão
        </Button>
      </SpellArchiveActions>

      <SpellLibraryView
        variant="user"
        records={libraryRecords}
        loading={loading}
        errorMessage={errorMessage}
      />

      {sendOpen ? (
        <div
          className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl border border-border bg-bg p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-lg font-semibold text-textH">
                  Enviar magia para sessão
                </h2>
                <p className="mt-1 text-xs leading-5 text-textMuted">
                  Mestres adicionam a magia imediatamente. Jogadores enviam uma solicitação para aprovação.
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSendOpen(false)}
              >
                Fechar
              </Button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-1.5 text-xs text-text">
                Magia homebrew
                <select
                  className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-textH outline-none"
                  value={selectedSpellId}
                  onChange={(event) => setSelectedSpellId(event.target.value)}
                >
                  {ownedRecords.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5 text-xs text-text">
                Sessão
                <select
                  className="h-10 rounded-xl border border-border bg-bg px-3 text-sm text-textH outline-none"
                  value={selectedCampaignId}
                  onChange={(event) => setSelectedCampaignId(event.target.value)}
                >
                  {availableCampaigns.map((campaign) => {
                    const isMaster = campaign.isOwner || campaign.role === "MASTER"
                    return (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name} · {isMaster ? "Mestre" : "Jogador"}
                      </option>
                    )
                  })}
                </select>
              </label>

              {sendMessage ? (
                <div className="rounded-xl border border-border bg-bg-subtle px-3 py-2 text-xs text-text">
                  {sendMessage}
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSendOpen(false)}>
                Cancelar
              </Button>
              <Button
                loading={sending}
                disabled={!selectedSpellId || !selectedCampaignId}
                onClick={() => void sendToSession()}
              >
                {availableCampaigns.find(
                  (campaign) => campaign.id === selectedCampaignId,
                )?.role === "MASTER" ||
                availableCampaigns.find(
                  (campaign) => campaign.id === selectedCampaignId,
                )?.isOwner
                  ? "Adicionar à sessão"
                  : "Enviar solicitação"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
