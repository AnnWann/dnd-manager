import { Button } from "../../../components/ui/Button"
import { Input } from "../../../components/ui/Input"
import { Select } from "../../../components/ui/Select"
import type { CharacterTemplate } from "../../../models/characters/CharacterTemplate"
import { DAMAGE_TYPE_OPTIONS, type DamageType } from "../../../models/combat/Damage"
import type { AttackRider } from "../../../models/combat/AttackRider"
import { parseAttackRiderDice } from "../../../models/combat/AttackRider"
import { ATTRIBUTES, CLASS_NAMES } from "../../../contexts/consts"
import type { Attribute } from "../../../models/sheet/Attribute"
import { useOptionalSessionRuntime } from "../../session-runtime/useSessionRuntime"

export function AttackRidersEditor({ riders, character, onChange, defaultScope = "weapon" }: {
  riders: AttackRider[]
  character?: CharacterTemplate
  defaultScope?: AttackRider["scope"]
  onChange: (riders: AttackRider[]) => void
}) {
  const runtime = useOptionalSessionRuntime()
  const targets = runtime?.initiativeState?.session?.entries ?? []
  const weapons = character?.get("equipment").weapons ?? []
  function patch(id: string, values: Partial<AttackRider>) {
    onChange(riders.map(rider => rider.id === id ? { ...rider, ...values } : rider))
  }
  return (
    <section className="grid gap-3 rounded-xl border border-border bg-bg-subtle p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold text-textH">Efeitos em ataques (riders)</div>
          <div className="text-[11px] text-textMuted">Dados extras, atributo de ataque e dano, tipos de dano e propriedades temporárias de armas.</div>
        </div>
        <Button size="sm" variant="secondary" onClick={() => onChange([...riders, {
          id: crypto.randomUUID(), label: "Dano adicional", scope: defaultScope, damage: { dice: "1d6", damageType: "fire" },
        }])}>+ Efeito</Button>
      </div>
      {riders.map(rider => (
        <div key={rider.id} className="grid gap-3 rounded-lg border border-border bg-bg-elevated p-3">
          <div className="flex items-center gap-2">
            <Input value={rider.label} placeholder="Nome do efeito" onChange={e => patch(rider.id, { label: e.target.value })} />
            <Button size="sm" variant="ghost" onClick={() => onChange(riders.filter(entry => entry.id !== rider.id))}>Remover</Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-textMuted">Aplica em
              <Select value={rider.scope} onChange={e => patch(rider.id, { scope: e.target.value as AttackRider["scope"], weaponId: undefined })}>
                <option value="all">Todos os ataques</option>
                <option value="weapon">Ataques com arma</option>
                <option value="unarmed">Ataques desarmados</option>
                <option value="spell">Ataques mágicos</option>
              </Select>
            </label>
            {rider.scope === "weapon" && !rider.weaponSelection ? (
              <label className="grid gap-1 text-xs text-textMuted">Arma afetada
                <Select value={rider.weaponId ?? ""} onChange={e => patch(rider.id, { weaponId: e.target.value || undefined })}>
                  <option value="">Todas as armas</option>
                  {weapons.map(weapon => <option key={weapon.id} value={weapon.id}>{weapon.name}</option>)}
                  {rider.weaponId && !weapons.some(weapon => weapon.id === rider.weaponId) ? <option value={rider.weaponId}>{rider.weaponId}</option> : null}
                </Select>
              </label>
            ) : null}
            <label className="grid gap-1 text-xs text-textMuted">Somente contra (opcional)
              <Select value={rider.targetEntryId ?? ""} onChange={e => patch(rider.id, { targetEntryId: e.target.value || undefined })}>
                <option value="">Qualquer alvo</option>
                {targets.map(target => <option key={target.id} value={target.id}>{target.customName || target.name}</option>)}
                {rider.targetEntryId && !targets.some(target => target.id === rider.targetEntryId) ? <option value={rider.targetEntryId}>{rider.targetEntryId}</option> : null}
              </Select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-textH">
            <input type="checkbox" checked={rider.targetSelection === "onCast"} onChange={e => patch(rider.id, { targetSelection: e.target.checked ? "onCast" : undefined })} />
            Escolher um alvo marcado ao conjurar
          </label>
          <label className="flex items-center gap-2 text-xs text-textH">
            <input type="checkbox" checked={Boolean(rider.damage)} onChange={e => patch(rider.id, {
              damage: e.target.checked ? { dice: "1d6", damageType: "fire" } : undefined,
              weaponDamageTypeMode: !e.target.checked && rider.weaponDamageTypeMode === "extra"
                ? undefined : rider.weaponDamageTypeMode,
            })} />
            Adicionar dano por acerto
          </label>
          {(rider.damage || rider.replaceWeaponDamageType || rider.weaponDamageTypeMode === "selected") ? <div className="grid gap-2 rounded-lg border border-border bg-bg-subtle p-3">
            <div className="text-xs font-semibold text-textH">Escolha do tipo de dano ao ativar</div>
            <p className="text-[11px] text-textMuted">Marque os tipos permitidos. Ao ativar, o jogador escolhe um deles. Você pode usar esse tipo também para a arma, ou vincular a arma ao tipo do dano extra.</p>
            <div className="flex flex-wrap gap-2">
              {DAMAGE_TYPE_OPTIONS.map(option => (
                <label key={option.value} className="flex items-center gap-1.5 text-xs text-textH">
                  <input type="checkbox" checked={(rider.damageTypeChoices ?? []).includes(option.value)}
                    onChange={e => {
                      const choices = e.target.checked
                        ? [...(rider.damageTypeChoices ?? []), option.value]
                        : (rider.damageTypeChoices ?? []).filter(value => value !== option.value)
                      // A selected weapon type must always have at least one valid option.
                      if (!choices.length && rider.weaponDamageTypeMode === "selected") return
                      patch(rider.id, { damageTypeChoices: choices })
                    }} />
                  {option.label}
                </label>
              ))}
            </div>
          </div> : null}
          {rider.damage ? <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs text-textMuted">Dados (ex.: 1d6 ou 2d8+1)
              <Input value={rider.damage.dice} onChange={e => patch(rider.id, { damage: { ...rider.damage!, dice: e.target.value } })} />
              {!parseAttackRiderDice(rider.damage.dice) ? <span className="text-danger">Use 1 a 20 dados d4, d6, d8, d10, d12 ou d20.</span> : null}
            </label>
            <label className="grid gap-1 text-xs text-textMuted">Tipo do dano adicional
              <Select value={rider.damage.damageType ?? ""} onChange={e => patch(rider.id, { damage: { ...rider.damage!, damageType: (e.target.value || undefined) as DamageType | undefined } })}>
                <option value="">Mesmo tipo da arma</option>
                {DAMAGE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </label>
          </div> : null}
          {rider.scope === "weapon" ? <>
            <label className="grid gap-1 text-xs text-textMuted">Arma afetada
              <Select value={rider.weaponSelection ?? "fixed"} onChange={e => patch(rider.id, {
                weaponSelection: e.target.value === "fixed" ? undefined : e.target.value as "onActivation" | "sourceWeapon",
                weaponId: undefined,
              })}>
                <option value="fixed">Arma escolhida acima (ou todas)</option>
                <option value="onActivation">Escolher arma ao ativar</option>
                <option value="sourceWeapon">Somente a arma que concede a habilidade</option>
              </Select>
            </label>
            <label className="grid gap-1 text-xs text-textMuted">Atributo para ataque e dano
              <Select value={rider.weaponAttackAttribute ?? "default"} onChange={e => patch(rider.id, {
                weaponAttackAttribute: e.target.value === "default" ? undefined : e.target.value as Attribute | "spellcasting",
                weaponSpellcastingClass: undefined,
              })}>
                <option value="default">Manter atributo normal da arma</option>
                {ATTRIBUTES.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                <option value="spellcasting">Atributo de conjuração</option>
              </Select>
            </label>
            {rider.weaponAttackAttribute === "spellcasting" ? (
              <label className="grid gap-1 text-xs text-textMuted">Classe de conjuração
                <Select value={rider.weaponSpellcastingClass ?? ""} onChange={e => patch(rider.id, { weaponSpellcastingClass: e.target.value || undefined })}>
                  <option value="">Maior modificador de conjuração disponível</option>
                  {Object.entries(CLASS_NAMES).map(([key, label]) =>
                    <option key={key} value={key}>{label}</option>)}
                </Select>
              </label>
            ) : null}
            {rider.weaponAttackAttribute ? (
              <p className="text-[11px] text-textMuted">Substitui o atributo dos ataques e do dano da arma enquanto ativo, sem conceder proficiência.</p>
            ) : null}
            <label className="grid gap-1 text-xs text-textMuted">Substituir o tipo de dano da arma
              <Select
                value={rider.weaponDamageTypeMode
                  ?? (rider.replaceWeaponDamageType
                    ? (rider.damageTypeChoices?.length ? "selected" : "fixed")
                    : "none")}
                onChange={e => {
                  const mode = e.target.value as "none" | "fixed" | "selected" | "extra"
                  patch(rider.id, {
                    weaponDamageTypeMode: mode === "none" ? undefined : mode,
                    replaceWeaponDamageType: mode === "fixed"
                      ? (rider.replaceWeaponDamageType ?? rider.damage?.damageType ?? "fire")
                      : undefined,
                    damageTypeChoices: mode === "selected" && !(rider.damageTypeChoices?.length)
                      ? ["acid", "cold", "fire", "thunder", "lightning"]
                      : rider.damageTypeChoices,
                  })
                }}
              >
                <option value="none">Não alterar</option>
                <option value="fixed">Tipo fixo</option>
                <option value="selected">Tipo escolhido ao ativar</option>
                {rider.damage ? <option value="extra">Mesmo tipo do dano adicional</option> : null}
              </Select>
            </label>
            {(rider.weaponDamageTypeMode
              ?? (rider.replaceWeaponDamageType
                ? (rider.damageTypeChoices?.length ? "selected" : "fixed")
                : "none")) === "fixed" ? (
              <label className="grid gap-1 text-xs text-textMuted">Tipo fixo da arma
                <Select value={rider.replaceWeaponDamageType ?? "fire"} onChange={e => patch(rider.id, { replaceWeaponDamageType: e.target.value as DamageType })}>
                  {DAMAGE_TYPE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </Select>
              </label>
            ) : null}
            {rider.weaponDamageTypeMode === "extra" ? (
              <p className="text-[11px] text-textMuted">O dano base da arma passa a ter o mesmo tipo do dano extra, inclusive quando o jogador escolhe um elemento na ativação.</p>
            ) : null}
            <label className="flex items-center gap-2 text-xs text-textH">
              <input type="checkbox" checked={Boolean(rider.addThrown)} onChange={e => patch(rider.id, { addThrown: e.target.checked })} />
              Conceder propriedade Arremesso
            </label>
            {rider.addThrown ? <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-xs text-textMuted">Alcance normal (pés)
                <Input type="number" min={1} value={rider.thrownNormalRange ?? 20} onChange={e => patch(rider.id, { thrownNormalRange: Math.max(1, Number(e.target.value) || 20) })} />
              </label>
              <label className="grid gap-1 text-xs text-textMuted">Alcance longo (pés)
                <Input type="number" min={1} value={rider.thrownLongRange ?? 60} onChange={e => patch(rider.id, { thrownLongRange: Math.max(1, Number(e.target.value) || 60) })} />
              </label>
              <label className="flex items-center gap-2 text-xs text-textH sm:col-span-2">
                <input type="checkbox" checked={Boolean(rider.returnsAfterThrow)} onChange={e => patch(rider.id, { returnsAfterThrow: e.target.checked })} />
                Arma retorna à mão após ser arremessada (efeito descritivo)
              </label>
            </div> : null}
          </> : null}
        </div>
      ))}
    </section>
  )
}
