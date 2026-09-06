import type { Itemmable } from "../../../../src/models/items/item";
import {
  cloneCreatureDropItemForGround,
  normalizeCreatureDrops,
} from "../../../../src/models/creatures/CreatureDrops";
import {
  normalizeInitiativeSession,
  type InitiativeEntry,
  type InitiativeSession,
} from "../../../../src/models/initiative/Initiative";
import { MAX_CHARACTER_STATE_LOG_RECORDS } from "../characters/sheet/characterState";
import {
  creatureIdFromSourceId,
} from "../initiative/initiativeCreatureProjection";
import {
  parseInitiativeClientMessage,
} from "../initiative/initiativeProtocol";
import {
  readInitiativeState,
} from "../initiative/InitiativeSessionActor";
import { SessionActor as BaseSessionActor } from "./SessionAdministrationSessionActor";
import type { SessionConnection } from "./protocol";
import { readRuntimeConfig } from "./runtimeConfigAccess";
import {
  SHARED_INVENTORY_SCOPE,
  commitSessionMutation,
  createSessionLogRecord,
  readSessionLog,
} from "./sessionLog";

const INVENTORY_STATE_KEY = "inventory-state";

type SharedInventoryState = {
  initialized: boolean;
  revision: number;
  partyInventory: Itemmable[];
  groundInventory: Itemmable[];
  carryCapacity?: number;
  additionalSupplyConsumption?: number;
  supplyConsumers?: Array<{ characterId: string; name: string }>;
  supplyPerLongRest?: number;
};

type CreatureLootResult = {
  entryId: string;
  creatureId: string;
  creatureName: string;
  roll?: number;
  rollGroupCount: number;
  itemCount: number;
};

/**
 * Final gameplay wrapper that connects compendium creature deaths to the
 * authoritative ground inventory.
 *
 * A drop is triggered only by a real alive -> defeated initiative transition.
 * Removing an entry never drops loot, and updates to an already defeated entry
 * are idempotent. Reviving and killing the creature again is a new death and
 * therefore a new drop.
 */
export class SessionActor extends BaseSessionActor {
  override async webSocketMessage(
    webSocket: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const raw = typeof message === "string"
      ? message
      : new TextDecoder().decode(message);
    const parsed = parseInitiativeClientMessage(raw);

    if (!parsed || parsed.type !== "session.initiative.operation") {
      await super.webSocketMessage(webSocket, message);
      return;
    }

    const beforeState = await readInitiativeState(this.ctx.storage);
    const before = beforeState.initialized
      ? normalizeInitiativeSession(
          beforeState.session as Partial<InitiativeSession>,
        )
      : null;

    await super.webSocketMessage(webSocket, message);

    if (!before) return;
    const afterState = await readInitiativeState(this.ctx.storage);
    if (!afterState.initialized || afterState.revision === beforeState.revision) return;

    const after = normalizeInitiativeSession(
      afterState.session as Partial<InitiativeSession>,
    );
    const newlyDefeated = findNewlyDefeatedCreatureEntries(before.entries, after.entries);
    if (!newlyDefeated.length) return;

    await this.dropCreatureLoot(webSocket, newlyDefeated);
  }

  private async dropCreatureLoot(
    webSocket: WebSocket,
    entries: InitiativeEntry[],
  ): Promise<void> {
    const [runtimeConfig, inventory, log] = await Promise.all([
      readRuntimeConfig(this.ctx.storage),
      this.readInventoryState(),
      readSessionLog(this.ctx.storage),
    ]);
    if (!runtimeConfig || !inventory.initialized) return;

    const creatures = new Map(
      runtimeConfig.config.creatureCompendium.map((creature) => [creature.id, creature]),
    );
    const droppedItems: Itemmable[] = [];
    const results: CreatureLootResult[] = [];

    for (const entry of entries) {
      const creatureId = creatureIdFromSourceId(entry.sourceId);
      if (!creatureId) continue;
      const creature = creatures.get(creatureId);
      if (!creature) continue;

      const drops = normalizeCreatureDrops(creature.drops);
      const selected: Itemmable[] = [...drops.guaranteed];
      let roll: number | undefined;

      if (drops.rollGroups.length) {
        roll = Math.floor(Math.random() * drops.rollGroups.length) + 1;
        selected.push(...drops.rollGroups[roll - 1].items);
      }

      const spawned = selected.map(cloneCreatureDropItemForGround);
      droppedItems.push(...spawned);
      results.push({
        entryId: entry.id,
        creatureId,
        creatureName: creature.name,
        ...(roll !== undefined ? { roll } : {}),
        rollGroupCount: drops.rollGroups.length,
        itemCount: spawned.length,
      });
    }

    if (!droppedItems.length) return;

    const connection = readConnection(webSocket);
    if (!connection) return;
    const beforeInventory = structuredClone(inventory);
    inventory.groundInventory.push(...droppedItems);
    inventory.revision += 1;

    const affectedScopes = [SHARED_INVENTORY_SCOPE];
    const record = createSessionLogRecord({
      actorId: connection.userId,
      operation: {
        type: "initiative.creature.loot.drop",
        characterId: "session",
        creatures: results,
        itemCount: droppedItems.length,
      },
      affectedScopes,
      reverseOperation: {
        type: "session.inventory.restore",
        characterId: "session",
        affectedScopes,
        snapshot: {
          abilities: {},
          hp: {},
          conditions: {},
          inventory: beforeInventory,
        },
      },
    });

    await commitSessionMutation(this.ctx.storage, this.ctx.getWebSockets(), {
      writes: { [INVENTORY_STATE_KEY]: inventory },
      record,
      currentLog: log,
      maxRecords: MAX_CHARACTER_STATE_LOG_RECORDS,
    });

    broadcast(this.ctx.getWebSockets(), {
      type: "session.inventory.updated",
      state: await this.readInventoryState(),
    });
  }

  private async readInventoryState(): Promise<SharedInventoryState> {
    return this.ctx.storage
      .get<SharedInventoryState>(INVENTORY_STATE_KEY)
      .then((value) => value ?? {
        initialized: false,
        revision: 0,
        partyInventory: [],
        groundInventory: [],
      });
  }
}

function findNewlyDefeatedCreatureEntries(
  before: InitiativeEntry[],
  after: InitiativeEntry[],
): InitiativeEntry[] {
  const beforeById = new Map(before.map((entry) => [entry.id, entry]));
  return after.filter((entry) => {
    const previous = beforeById.get(entry.id);
    if (!previous || previous.defeated || !entry.defeated) return false;
    // Only creatures created from the Creature Compendium qualify. Character
    // entries (including player characters and NPC character sheets) never do.
    return Boolean(creatureIdFromSourceId(entry.sourceId));
  });
}

function readConnection(socket: WebSocket): SessionConnection | null {
  try {
    const connection = socket.deserializeAttachment() as SessionConnection | null;
    return connection && typeof connection.userId === "string" ? connection : null;
  } catch {
    return null;
  }
}

function broadcast(sockets: WebSocket[], payload: unknown): void {
  const encoded = JSON.stringify(payload);
  for (const socket of sockets) {
    try { socket.send(encoded); } catch {}
  }
}
