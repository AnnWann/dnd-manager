import type { CharacterTemplate } from "../../models/characters/CharacterTemplate"
import type { CharacterCondition } from "../../models/characters/CharacterCondition"
import { withCharacterConditions } from "../../models/characters/characterConditionStorage"
import type { SessionHpState, SessionConditionsState, SessionDieSides } from "./sessionProtocol"

/** Apply live state after deserializing the sheet, shared by website and Owlbear. */
export function projectSessionCharacterState(
  character: CharacterTemplate,
  hp?: SessionHpState,
  conditions?: SessionConditionsState,
): CharacterTemplate {
  let projected = character
  if (hp) {
    const sheet = projected.get("sheet")
    const hitDice = Object.fromEntries(
      Object.entries(hp.hitDice ?? {}).flatMap(([side, pool]) =>
        pool ? [[side, {
          current: { quantity: pool.current, sides: side as SessionDieSides },
          max: { quantity: pool.max, sides: side as SessionDieSides },
        }]] : [],
      ),
    ) as typeof sheet.HP.hitDice
    projected = projected.withPatch({
      sheet: {
        ...sheet,
        attributes: hp.attributesInitialized ? { ...hp.attributes } : sheet.attributes,
        savingThrowProficiencies: hp.savingThrowsInitialized ? { ...hp.savingThrows } : sheet.savingThrowProficiencies,
        skills: hp.skillsInitialized ? { ...hp.skills } : sheet.skills,
        stats: hp.statsInitialized ? {
          ...sheet.stats,
          armorClassAdjustment: hp.stats.armorClassAdjustment,
          initiativeAdjustment: hp.stats.initiativeAdjustment,
          mobilityAdjustment: hp.stats.mobilityAdjustment,
          passivePerceptionAdjustment: hp.stats.passivePerceptionAdjustment,
          exhaustion: hp.stats.exhaustion,
          inspiration: hp.stats.inspiration,
          experience: hp.stats.experience,
        } : sheet.stats,
        HP: {
          ...sheet.HP,
          current: hp.current,
          temporary: hp.temporary,
          max: hp.max,
          currentMax: hp.currentMax,
          hitDice,
        },
      },
    })
  }
  if (conditions?.initialized) {
    projected = withCharacterConditions(projected, conditions.conditions as CharacterCondition[])
  }
  return projected
}
