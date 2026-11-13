import { useState } from "react"
import { Button } from "../../../components/ui/Button"
import { attributeShort } from "../../../lib/attributeShorts"
import { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { ATTRIBUTE_KEYS } from "../../../models/sheet/Attribute"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

export function ManualAttributeConfiguration({ character }: { character: CharacterTemplate }) {
  const runtime = useOptionalSessionRuntime()
  const [error, setError] = useState("")
  const snapshot = runtime?.abilitiesByCharacterId[character.get("id")]
  if (!snapshot?.initialized) return null

  let original: CharacterTemplate
  try {
    original = CharacterTemplate.fromJSON(snapshot.character)
  } catch {
    return null
  }
  const attributes = character.get("sheet").attributes
  const originalAttributes = original.get("sheet").attributes
  const changes = ATTRIBUTE_KEYS.filter(attribute => attributes[attribute] !== originalAttributes[attribute])
  if (!changes.length) return null
  const canConfirm = runtime.role === "MASTER" && runtime.status === "connected"

  function confirm() {
    if (!canConfirm) return
    setError("")
    // The projected character already contains the authoritative manual scores.
    // Resync promotes those scores into the structural snapshot used as baseline.
    const accepted = runtime.dispatchCharacterLifecycleOperation({
      type: "character.session.resync",
      characterId: character.get("id"),
      character: character.toJSON(),
    })
    if (!accepted) setError("Não foi possível enviar a confirmação dos atributos.")
  }

  return (
    <section className="rounded-xl border border-border bg-bg p-4 shadow-theme-sm">
      <h2 className="text-sm font-semibold text-textH">Oficializar ajustes de atributos</h2>
      <p className="mt-1 text-xs text-textMuted">
        Incorpore os valores manuais ao valor base da ficha. A indicação de ajuste manual desaparece após a confirmação.
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        {changes.map(attribute => (
          <span key={attribute} className="rounded-lg border border-border px-3 py-2 text-sm text-textH">
            {attributeShort(attribute)} {originalAttributes[attribute]} → {attributes[attribute]}
          </span>
        ))}
      </div>
      <Button variant="secondary" disabled={!canConfirm} onClick={confirm}>
        Oficializar ajustes
      </Button>
      {!canConfirm ? <p className="mt-2 text-xs text-textMuted">O mestre precisa estar conectado para confirmar.</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs text-danger">{error}</p> : null}
    </section>
  )
}
