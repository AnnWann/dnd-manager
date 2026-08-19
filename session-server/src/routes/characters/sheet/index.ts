import type { SessionLoggedOperation } from "../../session/protocol";
import { ATTRIBUTES_ROUTE, isAttributesRouteOperation } from "./attributes";
import { CONCENTRATION_ROUTE, isConcentrationRouteOperation } from "./concentration";
import { CONDITIONS_ROUTE, isConditionsRouteOperation } from "./conditions";
import { HIT_DICE_ROUTE, isHitDiceRouteOperation } from "./hitDice";
import { HP_ROUTE, isHpRouteOperation } from "./hp";
import { REST_ROUTE, isRestRouteOperation } from "./rest";
import { SAVING_THROWS_ROUTE, isSavingThrowsRouteOperation } from "./savingThrows";
import { SKILLS_ROUTE, isSkillsRouteOperation } from "./skills";
import { statRouteForOperation, type StatSheetRoute } from "./stats";

export type CharacterSheetRoute =
  | typeof HP_ROUTE
  | typeof HIT_DICE_ROUTE
  | StatSheetRoute
  | typeof ATTRIBUTES_ROUTE
  | typeof SAVING_THROWS_ROUTE
  | typeof SKILLS_ROUTE
  | typeof CONDITIONS_ROUTE
  | typeof CONCENTRATION_ROUTE
  | typeof REST_ROUTE;

export function routeForSheetOperation(operation: SessionLoggedOperation): CharacterSheetRoute {
  if (isHpRouteOperation(operation)) return HP_ROUTE;
  if (isHitDiceRouteOperation(operation)) return HIT_DICE_ROUTE;
  const statRoute = statRouteForOperation(operation);
  if (statRoute) return statRoute;
  if (isAttributesRouteOperation(operation)) return ATTRIBUTES_ROUTE;
  if (isSavingThrowsRouteOperation(operation)) return SAVING_THROWS_ROUTE;
  if (isSkillsRouteOperation(operation)) return SKILLS_ROUTE;
  if (isConcentrationRouteOperation(operation)) return CONCENTRATION_ROUTE;
  if (isConditionsRouteOperation(operation)) return CONDITIONS_ROUTE;
  if (isRestRouteOperation(operation)) return REST_ROUTE;
  throw new Error(`No character sheet route registered for operation ${operation.type}.`);
}
