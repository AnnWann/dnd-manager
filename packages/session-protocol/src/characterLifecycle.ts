export type SessionCharacterLifecycleOperation<TOwner> =
  | {
      type: "character.session.add"
      characterId: string
      character: Record<string, unknown>
      /**
       * Bootstrap adds are relational/Creation seeds, not normal session-only
       * lifecycle mutations. The server validates them against the active
       * session runtime config before accepting them.
       */
      origin?: "bootstrap"
    }
  | {
      type: "character.session.remove"
      characterId: string
    }
  | {
      /**
       * Irreversibly removes an already inactive character snapshot from this
       * session's Durable Object. The user's source character is not deleted.
       */
      type: "character.session.purge"
      characterId: string
    }
  | {
      type: "character.session.owner.set"
      characterId: string
      owner: TOwner
    }
  | {
      type: "character.session.resync"
      characterId: string
      character: Record<string, unknown>
    }
  | {
      /**
       * Removes a campaign member's live session presence and inactivates every
       * active character currently owned by that member.
       */
      type: "session.member.kick"
      characterId: "session"
      userId: string
    }
  | {
      /**
       * Maintenance-only operation intercepted by the final session actor.
       * It never enters the normal lifecycle mutation path.
       */
      type: "character.session.reconcile"
      characterId: "session"
      pairs: Array<{
        sourceCharacterId: string
        targetCharacterId: string
      }>
    }

export type SessionCharacterLifecycleClientMessage<TOwner> = {
  type: "session.character.operation"
  operation: SessionCharacterLifecycleOperation<TOwner>
}

export type SessionCharacterLifecycleState = {
  characterId: string
  character: Record<string, unknown>
  ownerUserId?: string
  active: boolean
  revision: number
}

export type SessionCharacterLifecycleServerMessage =
  | { type: "session.characters.snapshot"; characters: SessionCharacterLifecycleState[] }
  | { type: "session.character.updated"; character: SessionCharacterLifecycleState }
  | { type: "session.character.removed"; characterId: string }

