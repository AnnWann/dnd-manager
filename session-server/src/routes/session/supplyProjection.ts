import {
  CharacterTemplate,
  type CharacterTemplateProps,
} from "../../../../src/models/characters/CharacterTemplate";
import { getEffectiveRaceSupplyConsumption } from "../../../../src/models/supplies/partySupply";
import type {
  SessionSharedInventoryState,
  SessionSupplyConsumerSummary,
} from "../../../../src/features/session-runtime/inventorySessionProtocol";
import type { SessionAbilityState } from "../characters/abilities/abilityProtocol";
import type { SessionCharacterLifecycleState } from "./characterLifecycleProtocol";

const ABILITIES_STATE_KEY = "abilities-state";
const CHARACTER_LIFECYCLE_STATE_KEY = "characters-state";
const INVENTORY_STATE_KEY = "inventory-state";

export type SessionSupplyProjectionResult = {
  state: SessionSharedInventoryState | null;
  changed: boolean;
};

/**
 * Rebuilds the shared supply-consumer projection from the unfiltered Durable
 * Object character state. The projection intentionally exposes only character
 * id/name plus the aggregate consumption; race and individual consumption stay
 * inside visibility-filtered character snapshots.
 */
export async function reconcileSessionSupplyProjection(
  storage: DurableObjectStorage,
): Promise<SessionSupplyProjectionResult> {
  const inventory = await storage.get<SessionSharedInventoryState>(INVENTORY_STATE_KEY);
  if (!inventory?.initialized) return { state: inventory ?? null, changed: false };

  const [abilities, lifecycle] = await Promise.all([
    storage
      .get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)
      .then((value) => value ?? {}),
    storage
      .get<Record<string, SessionCharacterLifecycleState>>(CHARACTER_LIFECYCLE_STATE_KEY)
      .then((value) => value ?? {}),
  ]);

  const projected = buildAuthoritativeSupplyProjection(abilities, lifecycle);
  const currentConsumers = inventory.supplyConsumers ?? [];
  const currentPerLongRest = normalizeSupply(inventory.supplyPerLongRest ?? 0);
  const currentFoodPerLongRest = normalizeSupply(inventory.foodPerLongRest ?? currentPerLongRest);
  const currentDrinkPerLongRest = normalizeSupply(inventory.drinkPerLongRest ?? 0);
  const changed =
    currentPerLongRest !== projected.supplyPerLongRest ||
    currentFoodPerLongRest !== projected.foodPerLongRest ||
    currentDrinkPerLongRest !== projected.drinkPerLongRest ||
    JSON.stringify(currentConsumers) !== JSON.stringify(projected.consumers);

  if (!changed) return { state: inventory, changed: false };

  const next: SessionSharedInventoryState = {
    ...inventory,
    supplyConsumers: projected.consumers,
    supplyPerLongRest: projected.supplyPerLongRest,
    foodPerLongRest: projected.foodPerLongRest,
    drinkPerLongRest: projected.drinkPerLongRest,
  };
  await storage.put(INVENTORY_STATE_KEY, next);
  return { state: next, changed: true };
}

function buildAuthoritativeSupplyProjection(
  abilities: Record<string, SessionAbilityState>,
  lifecycle: Record<string, SessionCharacterLifecycleState>,
): {
  consumers: SessionSupplyConsumerSummary[];
  supplyPerLongRest: number;
  foodPerLongRest: number;
  drinkPerLongRest: number;
} {
  const consumers: Array<
    SessionSupplyConsumerSummary & { food: number; drink: number }
  > = [];

  for (const state of Object.values(abilities)) {
    if (!state?.initialized) continue;
    const characterId = state.characterId?.trim();
    const lifecycleState = characterId ? lifecycle[characterId] : undefined;
    if (!characterId || lifecycleState?.active !== true) continue;

    try {
      const character = CharacterTemplate.fromJSON(
        state.character as Partial<CharacterTemplateProps>,
      );
      const name = character.get("name").trim() || characterId;
      const consumption = getEffectiveRaceSupplyConsumption(
        character.get("sheet").race,
      );
      consumers.push({
        characterId,
        name,
        food: normalizeSupply(consumption.food),
        drink: normalizeSupply(consumption.drink),
      });
    } catch {
      // Invalid snapshots are already rejected by the character runtime. A bad
      // legacy record must not make the shared inventory projection unusable.
    }
  }

  consumers.sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR") ||
    left.characterId.localeCompare(right.characterId),
  );

  const foodPerLongRest = normalizeSupply(
    consumers.reduce((total, consumer) => total + consumer.food, 0),
  );
  const drinkPerLongRest = normalizeSupply(
    consumers.reduce((total, consumer) => total + consumer.drink, 0),
  );

  return {
    consumers: consumers.map(({ characterId, name }) => ({ characterId, name })),
    supplyPerLongRest: foodPerLongRest,
    foodPerLongRest,
    drinkPerLongRest,
  };
}

function normalizeSupply(value: number): number {
  const finite = Number.isFinite(value) ? Math.max(0, value) : 0;
  return Math.round((finite + Number.EPSILON) * 1_000_000) / 1_000_000;
}
