import type { CharacterTemplate as CharacterTemplateType } from "../../src/models/characters/CharacterTemplate";

declare module "../../src/models/characters/CharacterTemplate" {
  interface CharacterTemplate {
    useEquipmentAbility(
      itemId: string,
      abilityId: string,
      activationOptionId?: string,
    ): CharacterTemplateType;
  }
}
