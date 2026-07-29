from __future__ import annotations

import atexit
from pathlib import Path


@atexit.register
def correct_generated_ability_action_type() -> None:
    path = Path("src/features/characters/characterSheet/minimalCharacterActions.tsx")
    if not path.exists():
        return

    text = path.read_text()
    old = '''    if ("source" in ability && ability.source === "equipment") {
      return {
        ability,
        sourceLabel: `Equipamento: ${ability.sourceItemName}`,
        source: {
          type: "equipment",
          itemId: ability.sourceItemId,
          abilityId: ability.originalAbilityId,
        } as AbilitySource,
      }
    }'''
    new = '''    if ("source" in ability && ability.source === "equipment") {
      const equipmentAbility = ability as Ability & {
        source: "equipment"
        sourceItemName: string
        sourceItemId: string
        originalAbilityId: string
      }
      return {
        ability: equipmentAbility,
        sourceLabel: `Equipamento: ${equipmentAbility.sourceItemName}`,
        source: {
          type: "equipment",
          itemId: equipmentAbility.sourceItemId,
          abilityId: equipmentAbility.originalAbilityId,
        } as AbilitySource,
      }
    }'''

    if old not in text:
        raise RuntimeError("equipment ability narrowing block was not generated")

    path.write_text(text.replace(old, new, 1))
