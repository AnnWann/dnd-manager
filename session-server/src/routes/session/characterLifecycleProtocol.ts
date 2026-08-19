export type SessionCharacterOwner = {
  id: string;
  name: string;
  role: "player" | "master";
};

export type SessionCharacterLifecycleOperation =
  | {
      type: "character.session.add";
      characterId: string;
      character: Record<string, unknown>;
    }
  | {
      type: "character.session.remove";
      characterId: string;
    }
  | {
      type: "character.session.owner.set";
      characterId: string;
      owner: SessionCharacterOwner;
    }
  | {
      type: "character.session.resync";
      characterId: string;
      character: Record<string, unknown>;
    };

export type SessionCharacterLifecycleClientMessage = {
  type: "session.character.operation";
  operation: SessionCharacterLifecycleOperation;
};

export type SessionCharacterLifecycleState = {
  characterId: string;
  character: Record<string, unknown>;
  ownerUserId?: string;
  active: boolean;
  revision: number;
};

export type SessionCharacterLifecycleServerMessage =
  | {
      type: "session.characters.snapshot";
      characters: SessionCharacterLifecycleState[];
    }
  | {
      type: "session.character.updated";
      character: SessionCharacterLifecycleState;
    }
  | {
      type: "session.character.removed";
      characterId: string;
    };

export function parseCharacterLifecycleClientMessage(
  raw: string,
): SessionCharacterLifecycleClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || parsed.type !== "session.character.operation") return null;
  const operation = parsed.operation;
  if (!isRecord(operation) || typeof operation.type !== "string" || !isNonEmptyString(operation.characterId)) {
    return null;
  }

  switch (operation.type) {
    case "character.session.add":
    case "character.session.resync":
      if (!isRecord(operation.character)) return null;
      return {
        type: "session.character.operation",
        operation: {
          type: operation.type,
          characterId: operation.characterId,
          character: operation.character,
        },
      };
    case "character.session.remove":
      return {
        type: "session.character.operation",
        operation: { type: operation.type, characterId: operation.characterId },
      };
    case "character.session.owner.set":
      if (!isOwner(operation.owner)) return null;
      return {
        type: "session.character.operation",
        operation: {
          type: operation.type,
          characterId: operation.characterId,
          owner: operation.owner,
        },
      };
    default:
      return null;
  }
}

function isOwner(value: unknown): value is SessionCharacterOwner {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && (value.role === "player" || value.role === "master");
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
