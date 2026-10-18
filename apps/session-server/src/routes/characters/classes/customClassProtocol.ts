import type { CustomClassRuntimeConfig } from "../../../../../web/src/models/characters/customClassConfig";
import type { ClassName } from "../../../../../web/src/models/sheet/Class";

import type { SessionCustomClassOperation as SharedSessionCustomClassOperation, SessionCustomClassClientMessage as SharedSessionCustomClassClientMessage } from "../../../../../../packages/session-protocol/src/customClassOperations"
export type SessionCustomClassOperation = SharedSessionCustomClassOperation<CustomClassRuntimeConfig, ClassName>;
export type SessionCustomClassClientMessage = SharedSessionCustomClassClientMessage<CustomClassRuntimeConfig, ClassName>;

export function parseCustomClassClientMessage(raw: string): SessionCustomClassClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed?.type !== "session.custom-class.operation") return null;
    const operation = parsed.operation as Record<string, unknown> | undefined;
    if (
      !operation
      || operation.type !== "character.class.custom.configure"
      || typeof operation.characterId !== "string"
      || (operation.className !== undefined && typeof operation.className !== "string")
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
