import type { SessionLoggedOperation } from "../../../protocol";

export const SKILLS_ROUTE = "characters/sheet/skills" as const;

export function isSkillsRouteOperation(operation: SessionLoggedOperation): boolean {
  return operation.type === "character.skill.set";
}
