# Attack riders and temporary weapon infusions

This feature introduces `bonuses.attackRiders` on active character conditions, abilities (including abilities granted by conditions), and equipped items.

- `scope`: `all`, `weapon`, `unarmed`, or `spell`
- `damage: {dice, damageType?}`: separate per-hit damage packet; crit doubles dice, not flat bonuses. An omitted damage type inherits the weapon's current damage type.
- `replaceWeaponDamageType`: overrides the *base* weapon damage packet without changing other packets.
- `weaponId`: affects one equipped weapon. `weaponSelection: "onActivation"` asks the player to choose that weapon on use.
- `targetEntryId`: applies only against one initiative combatant; without a target selected, mark riders do not apply.
- `addThrown`, `thrownNormalRange`, `thrownLongRange`, `returnsAfterThrow`: temporary weapon-property information, not permanent inventory changes.

## Elemental Cleaver configuration

On a lasting active *Elemental Cleaver* ability, create five activation options, one for each acid, cold, fire, thunder and lightning. Each option grants a feature with an `attackRiders` entry:
- scope `weapon`
- `weaponSelection: "onActivation"`
- damage `{dice:"1d6", damageType:<element>}`
- `replaceWeaponDamageType: <element>`
- `addThrown: true`, ranges 20/60 feet, `returnsAfterThrow: true`

Enable **Permitir trocar a opção enquanto a habilidade estiver ativa** on the parent ability. Select the weapon when activating; subsequent switches preserve the originally chosen weapon. Model rage duration by ending this effect when rage ends. A separate automated rage-to-cleaver trigger is **not** yet included.

## Hex and Hunter's Mark

On cast, a supported concentration spell requires a selected initiative target. The session actor stores its rider on the caster's authoritative concentration condition; replacing/ending concentration removes it. Hex adds necrotic `1d6` to matching hit attacks. Hunter's Mark adds `1d6` with inherited weapon damage type.

Riders are rolled as separate damage entries; the interface displays prospective hit damage on an attack roll, as in the pre-existing attack-roll UI. There is not yet automatic confirmation that a roll hit the target's AC, nor automated damage application to the target.

## Deployment and testing

Both the frontend and the Cloudflare Session Server must be deployed for networked play. Before release run `npm run build` and `npm run typecheck:session-server`, and verify condition persistence, spell casting, switching, crits, and target selection.
