import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { isVersatileWeapon, isTwoHandedWeapon } from "../../game-core/src/weaponRules"

export type WeaponSwapItem = {
  id: string
  name?: string
  wieldedTwoHanded?: boolean
  properties?: ReadonlyArray<{ id: string }>
}

export function WeaponSwapDialog({
  open,
  pocketWeapons,
  equippedWeapons,
  selectedPocketWeaponId,
  selectedEquippedWeaponId,
  pocketsFull,
  onSelectedPocketWeaponChange,
  onSelectedEquippedWeaponChange,
  onWield,
  onStow,
  onClose,
}: {
  open: boolean
  pocketWeapons: Array<{ item: WeaponSwapItem; index: number }>
  equippedWeapons: WeaponSwapItem[]
  selectedPocketWeaponId: string
  selectedEquippedWeaponId: string
  pocketsFull: boolean
  onSelectedPocketWeaponChange: (id: string) => void
  onSelectedEquippedWeaponChange: (id: string) => void
  onWield: (hands: 1 | 2) => void
  onStow: () => void
  onClose: () => void
}) {
  const selectedPocketWeapon = pocketWeapons.find(
    ({ item }) => item.id === selectedPocketWeaponId,
  )?.item
  const versatile = selectedPocketWeapon
    ? isVersatileWeapon(selectedPocketWeapon)
    : false
  const twoHanded = selectedPocketWeapon
    ? isTwoHandedWeapon(selectedPocketWeapon)
    : false
  const hasGripChoice = versatile || twoHanded
  const [wieldHands, setWieldHands] = useState<1 | 2>(1)

  useEffect(() => {
    if (!open || !selectedPocketWeapon) return
    setWieldHands(
      twoHanded
        ? 2
        : selectedPocketWeapon.wieldedTwoHanded
          ? 2
          : 1,
    )
  }, [
    open,
    selectedPocketWeapon?.id,
    selectedPocketWeapon?.wieldedTwoHanded,
    twoHanded,
  ])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="weapon-swap-title"
        className="w-full max-w-md rounded-xl border border-border bg-bg-elevated p-4 shadow-theme-lg"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 id="weapon-swap-title" className="text-base font-semibold text-textH">
              Trocar Arma
            </h2>
            <p className="mt-1 text-xs leading-5 text-textMuted">
              Empunhe uma arma dos bolsos ou guarde uma arma equipada.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-textMuted hover:bg-bg-subtle hover:text-textH"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 py-4">
          <section className="grid gap-2">
            <div>
              <div className="text-xs font-semibold text-textH">Empunhar</div>
              <div className="text-[11px] text-textMuted">
                A arma equipada atual será guardada automaticamente ao trocar.
              </div>
            </div>
            <div className="grid gap-2">
              <select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                value={selectedPocketWeaponId}
                disabled={pocketWeapons.length === 0}
                aria-label="Arma do bolso para empunhar"
                onChange={(event) => onSelectedPocketWeaponChange(event.target.value)}
              >
                {pocketWeapons.length === 0 ? (
                  <option value="">Nenhuma arma no bolso</option>
                ) : (
                  pocketWeapons.map(({ item }) => (
                    <option key={item.id} value={item.id}>
                      {item.name || "Arma"}
                    </option>
                  ))
                )}
              </select>

              {hasGripChoice ? (
                <label className="grid gap-1">
                  <span className="text-[11px] font-medium text-textH">Empunhadura</span>
                  <select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                    value={String(wieldHands)}
                    aria-label="Empunhadura da arma"
                    onChange={(event) =>
                      setWieldHands(event.target.value === "2" ? 2 : 1)
                    }
                  >
                    {twoHanded ? (
                      <>
                        <option value="2">2 mãos — uso normal</option>
                        <option value="1">1 mão — improvisada</option>
                      </>
                    ) : (
                      <>
                        <option value="1">1 mão</option>
                        <option value="2">2 mãos — versátil</option>
                      </>
                    )}
                  </select>
                </label>
              ) : null}

              <button
                type="button"
                className="h-10 rounded-md border border-accentBorder bg-accentBg px-3 text-xs font-semibold text-textH transition-colors hover:bg-bg-subtle disabled:cursor-not-allowed disabled:opacity-50"
                disabled={pocketWeapons.length === 0}
                onClick={() => onWield(hasGripChoice ? wieldHands : 1)}
              >
                Trocar e empunhar
              </button>
            </div>
          </section>

          <section className="grid gap-2 border-t border-border pt-4">
            <div>
              <div className="text-xs font-semibold text-textH">Guardar</div>
              <div className="text-[11px] text-textMuted">Mova uma arma equipada para um bolso.</div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <select className="h-10 rounded-lg border border-border bg-bg px-3 text-sm text-textH"
                value={selectedEquippedWeaponId}
                disabled={equippedWeapons.length === 0}
                aria-label="Arma equipada para guardar"
                onChange={(event) => onSelectedEquippedWeaponChange(event.target.value)}
              >
                {equippedWeapons.length === 0 ? (
                  <option value="">Nenhuma arma equipada</option>
                ) : (
                  equippedWeapons.map((weapon) => (
                    <option key={weapon.id} value={weapon.id}>
                      {weapon.name || "Arma"}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                className="h-10 rounded-md border border-border bg-bg-subtle px-3 text-xs font-semibold text-textH transition-colors hover:border-accentBorder hover:bg-accentBg disabled:cursor-not-allowed disabled:opacity-50"
                disabled={equippedWeapons.length === 0 || pocketsFull}
                title={pocketsFull ? "Os oito espaços de bolso estão ocupados" : undefined}
                onClick={onStow}
              >
                Guardar
              </button>
            </div>
            {pocketsFull ? (
              <div className="text-[11px] text-danger">
                Os oito espaços de bolso estão ocupados.
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  )
}

