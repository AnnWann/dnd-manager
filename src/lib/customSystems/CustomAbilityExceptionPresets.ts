import type {
  CustomAbilityAcquisitionExceptionPresetDefinition,
  CustomAbilityTypeDefinition,
} from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

const MARTIAL_TECHNIQUES_SYSTEM_ID = 'system-5b1bda26-6a04-4f26-91be-3e96c2849ea5'
const MARTIAL_TECHNIQUE_TYPE_ID = 'tec_marcial'

/**
 * Battle Master replaces only the Fighter contribution to techniques learned.
 * Every other class keeps its own independent multiclass contribution.
 *
 * Fighter/Battle Master contribution:
 * 1-2: 2, 3-5: 7, 6-8: 10, 9-11: 13, 12-14: 16,
 * 15-17: 19, 18-19: 22, 20: 25.
 */
export const BATTLE_MASTER_MARTIAL_TECHNIQUES_FORMULA =
  'if(character.class.fighter.present, if(character.class.fighter.level < 3, min(6, floor((character.class.fighter.level + 3) / 4) + 1), 7 + 3 * max(0, floor(character.class.fighter.level / 3) - 1) + if(character.class.fighter.level >= 20, 3, 0)), 0) + if(character.class.barbarian.present, min(6, floor((character.class.barbarian.level + 3) / 4) + 1), 0) + if(character.class.rogue.present, min(6, floor((character.class.rogue.level + 3) / 4) + 1), 0) + if(character.class.monk.present, min(6, floor((character.class.monk.level + 3) / 4) + 1), 0) + if(character.class.paladin.present, min(6, floor((max(floor(character.class.paladin.level / 2), 1) + 3) / 4) + 1), 0) + if(character.class.ranger.present, min(6, floor((max(floor(character.class.ranger.level / 2), 1) + 3) / 4) + 1), 0)'

const BATTLE_MASTER_PRESET: CustomAbilityAcquisitionExceptionPresetDefinition = {
  id: 'battle-master',
  name: 'Mestre de Batalha',
  description:
    'No 3º nível de Guerreiro, soma as 3 técnicas da subclasse às 2 recebidas pelo Guerreiro. Nos marcos seguintes de Guerreiro, aprende 3 técnicas em vez de 2. As três técnicas concedidas pela subclasse devem ser marcadas como Sempre preparadas.',
  learnedLimitFormulaOverride: BATTLE_MASTER_MARTIAL_TECHNIQUES_FORMULA,
  alwaysPreparedSelectionCount: 3,
}

/**
 * Configured presets always win. When a type has never configured presets,
 * known legacy/homebrew defaults can be supplied without mutating persisted data.
 * As soon as the master edits this area, even an empty array becomes authoritative.
 */
export function getCustomAbilityAcquisitionExceptionPresets(
  definition: CustomSystemDefinition,
  type: CustomAbilityTypeDefinition,
): CustomAbilityAcquisitionExceptionPresetDefinition[] {
  if (type.acquisitionExceptionPresets !== undefined) {
    return type.acquisitionExceptionPresets
  }

  if (
    definition.id === MARTIAL_TECHNIQUES_SYSTEM_ID
    && type.id === MARTIAL_TECHNIQUE_TYPE_ID
  ) {
    return [BATTLE_MASTER_PRESET]
  }

  return []
}
