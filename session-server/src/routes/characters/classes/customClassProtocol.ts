import type { CustomClassRuntimeConfig } from "../../../../../src/models/characters/customClassConfig";

export type SessionCustomClassOperation = {
  type: "character.class.custom.configure";
  characterId: string;
  config: CustomClassRuntimeConfig;
};

export type SessionCustomClassClientMessage = {
  type: "session.custom-class.operation";
  operation: SessionCustomClassOperation;
};

export function parseCustomClassClientMessage(raw: string): SessionCustomClassClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.type !== "session.custom-class.operation") return null;
    const operation = parsed.operation as Record<string, unknown> | undefined;
    if (
      !operation
      || operation.type !== "character.class.custom.configure"
      || typeof operation.characterId !== "string"
      || !operation.config
      || typeof operation.config !== "object"
    ) {
      return null;
    }
    return parsed as SessionCustomClassClientMessage;
  } catch {
    return null;
  }
}
