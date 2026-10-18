import type { CustomAbilityTypeDefinition } from '../../models/customSystems/CustomAbilityDefinition'
import type { CustomSystemDefinition } from '../../models/customSystems/CustomSystemDefinition'

/**
 * Returns only the default acquisition exceptions explicitly configured in the
 * Custom System definition. This layer must never infer presets from a system,
 * ability type, subclass, feat, or any other hardcoded game rule.
 *
 * Rules such as Battle Master are data owned by the Custom System creator and
 * are configured through the Custom Systems editor.
 */
export function getCustomAbilityAcquisitionExceptionPresets(
  _definition: CustomSystemDefinition,
  type: CustomAbilityTypeDefinition,
) {
  return type.acquisitionExceptionPresets ?? []
}
