import { SessionActor as BaseSessionActor } from "./SessionActor";
import { SessionActor as AbilitySessionActor } from "../characters/abilities/AbilitySessionActor";
import { SessionActor as MagicSessionActor } from "../characters/spells/MagicSessionActor";
import { SessionActor as EquipmentSessionActor } from "../characters/equipment/EquipmentSessionActor";
import { SessionActor as InventorySessionActor } from "../characters/inventory/InventorySessionActor";
import { SessionActor as ProficiencySessionActor } from "../characters/proficiencies/ProficiencySessionActor";
import { SessionActor as RaceSessionActor } from "../characters/race/RaceSessionActor";
import { SessionActor as ProfileSessionActor } from "../characters/profile/ProfileSessionActor";
import { parseAbilityClientMessage, type SessionAbilityState } from "../characters/abilities/abilityProtocol";
import { parseMagicClientMessage } from "../characters/spells/magicProtocol";
import { parseEquipmentClientMessage } from "../characters/equipment/equipmentProtocol";
import { parseInventoryClientMessage } from "../characters/inventory/inventoryProtocol";
import { parseProficiencyClientMessage } from "../characters/proficiencies/proficiencyProtocol";
import { parseRaceClientMessage } from "../characters/race/raceProtocol";
import { parseProfileClientMessage } from "../characters/profile/profileProtocol";

const ABILITIES_STATE_KEY = "abilities-state";
const INVENTORY_STATE_KEY = "inventory-state";
const HP_LOG_KEY = "hp-log";

type DomainActor = {
  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void>;
};

type SharedInventoryState = {
  initialized: boolean;
  revision: number;
  partyInventory: unknown[];
  groundInventory: unknown[];
};

type UnifiedLogRecord = {
  id: string;
  reverseOperation?: { type?: string };
};

/**
 * The only Durable Object exported by the worker.
 *
 * Domain actors are used as composed route handlers, not as an inheritance chain.
 * The central dispatcher decides which domain owns a message before invoking it,
 * so a domain handler never has to forward an unrelated message through `super`.
 */
export class SessionActor extends BaseSessionActor {
  private readonly abilityRoute = bindDomainActor(AbilitySessionActor.prototype, this.ctx);
  private readonly magicRoute = bindDomainActor(MagicSessionActor.prototype, this.ctx);
  private readonly equipmentRoute = bindDomainActor(EquipmentSessionActor.prototype, this.ctx);
  private readonly inventoryRoute = bindDomainActor(InventorySessionActor.prototype, this.ctx);
  private readonly proficiencyRoute = bindDomainActor(ProficiencySessionActor.prototype, this.ctx);
  private readonly raceRoute = bindDomainActor(RaceSessionActor.prototype, this.ctx);
  private readonly profileRoute = bindDomainActor(ProfileSessionActor.prototype, this.ctx);

  override async fetch(request: Request): Promise<Response> {
    const response = await super.fetch(request);
    if (response.status !== 101) return response;

    const clientId = request.headers.get("x-session-client-id")?.trim();
    if (!clientId) return response;

    const socket = this.ctx.getWebSockets().find((candidate) => {
      try {
        const connection = candidate.deserializeAttachment() as { clientId?: unknown } | null;
        return connection?.clientId === clientId;
      } catch {
        return false;
      }
    });
    if (!socket) return response;

    await Promise.all([
      this.sendAbilitySnapshot(socket),
      this.sendInventorySnapshot(socket),
    ]);
    return response;
  }

  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);

    const undoLogId = parseUndoLogId(raw);
    if (undoLogId) {
      const undoRoute = await this.resolveUndoRoute(undoLogId);
      if (undoRoute) {
        await undoRoute.webSocketMessage(webSocket, message);
        return;
      }
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const route = resolveMessageRoute(raw, {
      ability: this.abilityRoute,
      magic: this.magicRoute,
      equipment: this.equipmentRoute,
      inventory: this.inventoryRoute,
      proficiency: this.proficiencyRoute,
      race: this.raceRoute,
      profile: this.profileRoute,
    });

    if (route) {
      await route.webSocketMessage(webSocket, message);
      return;
    }

    await super.webSocketMessage(webSocket, message);
  }

  private async resolveUndoRoute(logId: string): Promise<DomainActor | null> {
    const log = (await this.ctx.storage.get<UnifiedLogRecord[]>(HP_LOG_KEY)) ?? [];
    const source = log.find((record) => record.id === logId);
    const reverseType = source?.reverseOperation?.type;

    switch (reverseType) {
      // Ability, Magic and Equipment all use the composite ability snapshot.
      case "character.ability.restore":
        return this.abilityRoute;
      case "session.inventory.restore":
        return this.inventoryRoute;
      case "session.proficiency.restore":
        return this.proficiencyRoute;
      case "session.race.restore":
        return this.raceRoute;
      case "session.profile.restore":
        return this.profileRoute;
      default:
        return null;
    }
  }

  private async sendAbilitySnapshot(socket: WebSocket): Promise<void> {
    const state = (await this.ctx.storage.get<Record<string, SessionAbilityState>>(ABILITIES_STATE_KEY)) ?? {};
    send(socket, {
      type: "session.abilities.snapshot",
      characters: Object.values(state),
    });
  }

  private async sendInventorySnapshot(socket: WebSocket): Promise<void> {
    const state = (await this.ctx.storage.get<SharedInventoryState>(INVENTORY_STATE_KEY)) ?? {
      initialized: false,
      revision: 0,
      partyInventory: [],
      groundInventory: [],
    };
    send(socket, { type: "session.inventory.snapshot", state });
  }
}

function resolveMessageRoute(
  raw: string,
  routes: {
    ability: DomainActor;
    magic: DomainActor;
    equipment: DomainActor;
    inventory: DomainActor;
    proficiency: DomainActor;
    race: DomainActor;
    profile: DomainActor;
  },
): DomainActor | null {
  // Use each domain parser as the routing contract. Malformed domain messages fall
  // through to the base actor, which returns the normal INVALID_MESSAGE response.
  if (parseAbilityClientMessage(raw)) return routes.ability;
  if (parseMagicClientMessage(raw)) return routes.magic;
  if (parseEquipmentClientMessage(raw)) return routes.equipment;
  if (parseInventoryClientMessage(raw)) return routes.inventory;
  if (parseProficiencyClientMessage(raw)) return routes.proficiency;
  if (parseRaceClientMessage(raw)) return routes.race;
  if (parseProfileClientMessage(raw)) return routes.profile;
  return null;
}

function bindDomainActor<T extends DomainActor>(prototype: T, ctx: unknown): T {
  const actor = Object.create(prototype) as T;
  Object.defineProperty(actor, "ctx", {
    value: ctx,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return actor;
}

function parseUndoLogId(raw: string): string | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown; logId?: unknown };
    return value.type === "session.log.undo" && typeof value.logId === "string"
      ? value.logId
      : null;
  } catch {
    return null;
  }
}

function send(socket: WebSocket, value: unknown): void {
  try {
    socket.send(JSON.stringify(value));
  } catch {
    // Stale sockets are cleaned up by the base SessionActor.
  }
}
