import type { DamageType } from "../../models/combat/Damage"
import type { CharacterGrantedEquipmentSpellUsageSource, CharacterGrantedSpellUsageSource } from "../../models/characters/characterGrantedSpells"
import type { SpellResourceType } from "../../models/magic/spells/Spell"
import type { SessionDiceRollMode, SessionRollVisibility } from "../../shared/session-runtime/diceRollProtocol"

import type { SessionSpellCastPayment as SharedPayment, SessionMagicOperation as SharedMagicOperation } from "../../../../../packages/session-protocol/src/magicOperations"

export type SessionSpellCastPayment = SharedPayment<SpellResourceType, CharacterGrantedSpellUsageSource, CharacterGrantedEquipmentSpellUsageSource>
export type SessionMagicOperation = SharedMagicOperation<SpellResourceType, CharacterGrantedSpellUsageSource, CharacterGrantedEquipmentSpellUsageSource, DamageType, SessionDiceRollMode, SessionRollVisibility>
