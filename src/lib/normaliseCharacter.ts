import type { Character, CustomAbility } from "../types";
import type { AppStateV1 } from "./remoteState";
import { defaultEquipment, weaponSlotsFromLimbCount } from "./character";
import { normalizeDeathSaves, normalizeInventoryItems } from './inventory'
import type { InitiativeResult } from "../features/initiative/initiative";

export function normalizeCharacter(character: any): Character {
  const attributes =
    character.attributes ??
    character.abilities ??
    {
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
    }

  const classes = (character.classes ?? []).map((cls: any) => {
    if (cls?.classIndex === 'eldritch_knight') {
      return {
        ...cls,
        classIndex: 'fighter',
        className: 'Guerreiro',
        spellcastingProgression: 'third',
        castingAbility: cls.castingAbility ?? 'int',
      }
    }

    if (cls?.classIndex === 'arcane_trickster') {
      return {
        ...cls,
        classIndex: 'rogue',
        className: 'Ladino',
        spellcastingProgression: 'third',
        castingAbility: cls.castingAbility ?? 'int',
      }
    }

    return {
      ...cls,
      castingAbility: cls?.castingAbility ?? 'int',
    }
  })

  const equipmentBase = {
    ...defaultEquipment(character.equipment?.limbCount ?? 2),
    ...(character.equipment ?? {}),
  }

  const limbCount = Math.max(0, Math.trunc(equipmentBase.limbCount ?? 2))
  const weaponSlotsCount = weaponSlotsFromLimbCount(limbCount)

  const normalizeSlot = (slot: any) => ({
    name: String(slot?.name ?? ''),
    bonuses: {
      armorClass: Number(slot?.bonuses?.armorClass ?? 0),
      initiative: Number(slot?.bonuses?.initiative ?? 0),
      initiativeBonus: Number(slot?.bonuses?.initiativeBonus ?? 0),
      maxHp: Number(slot?.bonuses?.maxHp ?? 0),
      currentHp: Number(slot?.bonuses?.currentHp ?? 0),
      temporaryHp: Number(slot?.bonuses?.temporaryHp ?? 0),
      passivePerception: Number(slot?.bonuses?.passivePerception ?? 0),
      attackBonus: Number(slot?.bonuses?.attackBonus ?? 0),
      mobility: Number(slot?.bonuses?.mobility ?? 0),
    },
    twoHanded: Boolean(slot?.twoHanded),
    notes: String(slot?.notes ?? ''),
  })

  const equipment = {
    ...equipmentBase,
    armor: normalizeSlot(equipmentBase.armor),
    boots: normalizeSlot(equipmentBase.boots),
    helmet: normalizeSlot(equipmentBase.helmet),
    gloves: normalizeSlot(equipmentBase.gloves),
    rings: Array.from({ length: 3 }, (_, idx) => normalizeSlot((equipmentBase.rings ?? [])[idx])),
    limbCount,
    weaponSlots: Array.from({ length: weaponSlotsCount }, (_, idx) => normalizeSlot((equipmentBase.weaponSlots ?? [])[idx])),
    pocket: Array.from({ length: 8 }, (_, idx) => normalizeSlot((equipmentBase.pocket ?? [])[idx])),
  }

  const customAbilities: CustomAbility[] = (character.customAbilities ?? []).map((item: any) => {
    if (typeof item === 'string') {
      return { id: crypto.randomUUID(), name: String(item), usage: undefined }
    }

    const name = String(item?.name ?? item?.label ?? '')
    const description = String(item?.description ?? item?.desc ?? '').trim()
    const usage = item?.usage
    if (!usage || typeof usage !== 'object') {
      return { id: String(item?.id ?? crypto.randomUUID()), name, description: description || undefined, usage: undefined }
    }

    const reset = usage.reset === 'turn' || usage.reset === 'cooldown' || usage.reset === 'shortRest' || usage.reset === 'longRest' ? usage.reset : undefined
    const max = Number(usage.max ?? usage.maxUses ?? 0)
    const used = Number(usage.used ?? 0)
    const cooldownAmount = Number(usage.cooldownAmount ?? usage.cooldown ?? 1)
    const cooldownUnit = usage.cooldownUnit === 'turns' || usage.cooldownUnit === 'minutes' || usage.cooldownUnit === 'hours' || usage.cooldownUnit === 'days' || usage.cooldownUnit === 'tenDays'
      ? usage.cooldownUnit
      : 'turns'
    return {
      id: String(item?.id ?? crypto.randomUUID()),
      name,
      description: description || undefined,
      usage: reset && Number.isFinite(max) && max > 0
        ? {
            max: Math.max(0, Math.trunc(max)),
            used: Math.max(0, Math.trunc(used)),
            reset,
            cooldownAmount: reset === 'cooldown' ? Math.max(1, Math.trunc(cooldownAmount) || 1) : undefined,
            cooldownUnit: reset === 'cooldown' ? cooldownUnit : undefined,
          }
        : undefined,
    }
  }).filter((ability: CustomAbility) => ability.name.trim().length > 0)

  return {
    ...character,
    attributes,
    type: character.type ?? 'pc',
    visibilityRole: character.visibilityRole ?? 'player',
    ownerKey: character.ownerKey ?? '',
    skills: character.skills ?? {},
    classes,
    spells: character.spells ?? [],
    armorClass: character.armorClass ?? 10,
    mobility: Number(character.mobility ?? 9),
    initiativeBonus: character.initiativeBonus ?? 0,
    maxHp: character.maxHp ?? 0,
    currentHp: Math.min(character.currentHp ?? 0, character.maxHp ?? 0),
    temporaryHp: character.temporaryHp ?? 0,
    hitDice: character.hitDice ?? [],
    customAbilities,
    equipment,
    notes: String(character.notes ?? ''),
    initiativeMode: character.type === 'pc' ? 'unique' : (character.initiativeMode ?? 'general'),
    personalInventory: normalizeInventoryItems(character.personalInventory),
    deathSaves: normalizeDeathSaves(character.deathSaves),
  }
}

export function normalizeAppState(state: AppStateV1): AppStateV1 {
  const initiativeOrder = (state.initiativeOrder ?? [])
  .map(normalizeInitiativeResult)
  .filter((entry): entry is InitiativeResult => entry !== null)
  
  return {
    ...state,
    characters: state.characters.map(normalizeCharacter),
    spellCache: state.spellCache ?? {},
    effectPresets: state.effectPresets ?? {},
    homebrewLibrary: state.homebrewLibrary ?? {},
    spellTranslations: state.spellTranslations ?? {},
    initiativeOrder,
    currentTurnIndex:
      initiativeOrder.length === 0
        ? 0
        : Math.min(state.currentTurnIndex ?? 0, initiativeOrder.length - 1),
    campInventory: normalizeInventoryItems(state.campInventory),
  }
}

function normalizeInitiativeResult(entry: any): InitiativeResult | null {
  const character = entry.character as Character | undefined

  if (!character && !entry.sourceCharacterId) return null

  return {
    id: String(entry.id ?? character?.id ?? crypto.randomUUID()),
    sourceCharacterId: String(entry.sourceCharacterId ?? character?.id ?? ''),
    displayName: String(entry.displayName ?? character?.name ?? 'Sem nome'),

    currentHp: Number(entry.currentHp ?? character?.currentHp ?? 0),
    maxHp: Number(entry.maxHp ?? character?.maxHp ?? 0),
    temporaryHp: Number(entry.temporaryHp ?? character?.temporaryHp ?? 0),
    armorClass: Number(entry.armorClass ?? character?.armorClass ?? 10),

    rolledValue: Number(entry.rolledValue ?? 0),
    initiative: Number(entry.initiative ?? 0),

    ownerKey: entry.ownerKey ?? character?.ownerKey,
    visibilityRole: entry.visibilityRole ?? character?.visibilityRole,

    effects: entry.effects ?? [],
  }
}