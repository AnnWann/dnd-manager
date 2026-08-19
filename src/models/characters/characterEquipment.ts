import type { Ability, Usage } from "../abilities/Ability"
import { endAbilityEffect, restoreAbilityUse, useAbilityEffect } from "../abilities/abilityActivation"
import type { CharacterTemplate } from "./CharacterTemplate"
import type { Equipment } from "../items/equipment/EquipmentSlot"
import type { Weapon } from "../items/equipment/Weapon"
import type { Itemmable } from "../items/item"
import { getWeaponHandsUsed, toWeapon } from "../items/equipment/Weapon"

/*
 * NOTE: this file is intentionally kept as the complete replacement from the
 * current branch. The ability runtime change below only extends
 * useEquipmentAbility with activationOptionId and forwards it to
 * useAbilityEffect.
 */
