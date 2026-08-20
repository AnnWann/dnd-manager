import type { CustomSystemDefinition } from "../../../../../src/models/customSystems/CustomSystemDefinition";
import type { CreationCharacterCustomSystemConfiguration } from "../../../../../src/shared/creation/creation.types";
import type { SessionRuntimeConfigSnapshot } from "../../../../../src/shared/session-runtime/sessionRuntimeConfig";
import {
  findRuntimeCustomSystem,
  getRuntimeCharacterConfig,
} from "../../session/runtimeConfigAccess";

export type RuntimeCustomSystemAccess = {
  definition: CustomSystemDefinition;
  installation: CreationCharacterCustomSystemConfiguration;
};

export type RuntimeCustomSystemAccessResult =
  | { ok: true; value: RuntimeCustomSystemAccess }
  | { ok: false; code: string; message: string };

export function validateRuntimeCustomSystemAccess(
  snapshot: SessionRuntimeConfigSnapshot | null,
  characterId: string,
  systemId: string,
): RuntimeCustomSystemAccessResult {
  if (!snapshot) {
    return rejected(
      "RUNTIME_CONFIG_NOT_INITIALIZED",
      "The MASTER must publish saved Creation configuration before custom systems can be changed.",
    );
  }

  const character = getRuntimeCharacterConfig(snapshot, characterId);
  if (!character) {
    return rejected(
      "CHARACTER_NOT_IN_CREATION",
      "This character is not part of the active Creation configuration.",
    );
  }

  const installation = character.customSystems.find((entry) => entry.systemId === systemId);
  if (!installation) {
    return rejected(
      "CUSTOM_SYSTEM_NOT_INSTALLED",
      "This custom system is not installed for the character in the active Creation configuration.",
    );
  }
  if (!installation.enabled) {
    return rejected(
      "CUSTOM_SYSTEM_DISABLED",
      "This custom system is disabled for the character in the active Creation configuration.",
    );
  }

  const definition = findRuntimeCustomSystem(snapshot, systemId);
  if (!definition) {
    return rejected(
      "CUSTOM_SYSTEM_DEFINITION_NOT_FOUND",
      "The installed custom-system definition is missing from the active Creation configuration.",
    );
  }
  if (definition.version !== installation.systemVersion) {
    return rejected(
      "CUSTOM_SYSTEM_VERSION_MISMATCH",
      "The character custom-system installation does not match the active definition version.",
    );
  }

  return { ok: true, value: { definition, installation } };
}

function rejected(code: string, message: string): RuntimeCustomSystemAccessResult {
  return { ok: false, code, message };
}
