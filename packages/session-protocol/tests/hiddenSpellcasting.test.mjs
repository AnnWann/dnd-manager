import assert from "node:assert/strict"
import test from "node:test"
import { parseHiddenSpellClientMessage, projectHiddenSpell } from "../src/hiddenSpellcasting.ts"

test("unrevealed choices never leak spell, level, payment, or counterspell checks", () => {
  const commitment = {
    id: "cast-1", ownerUserId: "user-1",
    actor: { kind: "character", characterId: "hero" },
    actorLabel: "Aldren", spellIndex: "fireball", spellName: "Bola de Fogo",
    castLevel: 5, sourceId: "wizard", payment: { type: "slot", level: 5 },
    createdAt: "2026-10-26T12:00:00.000Z",
    counterspellCheck: { die: 10, modifier: 3, total: 13, dc: 15, success: false },
  }
  const pending = projectHiddenSpell(commitment)
  assert.equal(pending.status, "hidden")
  for (const secret of ["fireball", "Bola de Fogo", "slot", "counterspellCheck", '"castLevel"']) {
    assert.equal(JSON.stringify(pending).includes(secret), false, secret)
  }
  const revealed = projectHiddenSpell({ ...commitment, revealedAt: "2026-10-26T12:01:00.000Z" })
  assert.equal(revealed.spellName, "Bola de Fogo")
  assert.equal(revealed.castLevel, 5)
  assert.equal(revealed.counterspellCheck?.dc, 15)
  assert.equal(JSON.stringify(revealed).includes('"payment"'), false)
})

test("creature commitments validate identity, circle and counterspell target", () => {
  const valid = {
    type: "session.hiddenSpell.commit", requestId: "request-1",
    actor: { kind: "creature", creatureId: "wizard", initiativeEntryId: "turn-1" },
    spellIndex: "counterspell", castLevel: 3, counterspellTargetId: "cast-1",
    mode: "normal",
  }
  assert.deepEqual(parseHiddenSpellClientMessage(JSON.stringify(valid)), valid)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, castLevel: 10 })), null)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, actor: { kind: "creature", creatureId: "" } })), null)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, spellIndex: "" })), null)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, counterspellTargetId: "invalid!" })), null)
  assert.deepEqual(parseHiddenSpellClientMessage('{"type":"session.hiddenSpell.reveal","id":"cast-1"}'), { type: "session.hiddenSpell.reveal", id: "cast-1" })
})

test("character commits require a source and payment", () => {
  const valid = {
    type: "session.hiddenSpell.commit", requestId: "request-2",
    actor: { kind: "character", characterId: "hero" },
    spellIndex: "shield", sourceId: "wizard", castLevel: 1,
    payment: { type: "slot", level: 1, pool: "normal" },
  }
  assert.deepEqual(parseHiddenSpellClientMessage(JSON.stringify(valid)), { ...valid, mode: "normal" })
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, sourceId: undefined })), null)
  assert.equal(parseHiddenSpellClientMessage(JSON.stringify({ ...valid, payment: undefined })), null)
})
