import assert from "node:assert/strict"
import test from "node:test"
import { parseHiddenSpellClientMessage, projectHiddenSpell } from "../src/hiddenSpellcasting.ts"

test("hidden spell projection never exposes private spell fields, even to MASTER", () => {
  const commitment = {
    id: "cast-1", ownerUserId: "user-1",
    actor: { kind: "character", characterId: "hero" },
    actorLabel: "Aldren", spellIndex: "fireball", spellName: "Bola de Fogo",
    castLevel: 5, payment: { type: "slot", level: 5 },
    createdAt: "2026-10-26T12:00:00.000Z",
  }
  const pending = projectHiddenSpell(commitment)
  assert.equal(pending.status, "hidden")
  assert.equal(JSON.stringify(pending).includes("fireball"), false)
  assert.equal(JSON.stringify(pending).includes("Bola de Fogo"), false)
  assert.equal(JSON.stringify(pending).includes("slot"), false)
  assert.equal(JSON.stringify(pending).includes("5"), false)
  const revealed = projectHiddenSpell({ ...commitment, revealedAt: "2026-10-26T12:01:00.000Z" })
  assert.equal(revealed.status, "revealed")
  assert.equal(revealed.spellName, "Bola de Fogo")
  assert.equal(revealed.castLevel, 5)
  assert.equal(JSON.stringify(revealed).includes("payment"), false)
})

test("hidden spell commitment validates spell, actor and level", () => {
  const valid = {
    type: "session.hiddenSpell.commit", requestId: "request-1",
    actor: { kind: "creature", creatureId: "wizard", initiativeEntryId: "turn-1" },
    spellIndex: "counterspell", spellName: "Contramágica", castLevel: 3,
  }
  assert.deepEqual(parseHiddenSpellClientMessage(JSON.stringify(valid)), valid)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, castLevel: 10 })), null)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, actor: { kind: "creature", creatureId: "" } })), null)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, spellIndex: "" })), null)
  assert.deepEqual(parseHiddenSpellClientMessage('{"type":"session.hiddenSpell.reveal","id":"cast-1"}'), { type: "session.hiddenSpell.reveal", id: "cast-1" })
})
