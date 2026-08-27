import spellData from "../../../src/data/spells.v1.json"
import type { Spell } from "../../../src/models/magic/spells/Spell"

const CACHE_CONTROL = "public, max-age=86400, stale-while-revalidate=604800"

const spellByIndex = new Map<string, Spell>(
  (spellData.spells as unknown[]).map((rawSpell) => {
    const { source: _source, ...spell } = rawSpell as Record<string, unknown>
    const parsed = spell as unknown as Spell
    return [parsed.index, parsed]
  }),
)

type RouteContext = {
  params: Promise<{
    index: string
  }>
}

export async function GET(
  _request: Request,
  context: RouteContext,
): Promise<Response> {
  const { index } = await context.params
  const spell = spellByIndex.get(index)

  if (!spell) {
    return Response.json(
      {
        error: {
          code: "SPELL_NOT_FOUND",
          message: "Magia oficial não encontrada.",
        },
      },
      {
        status: 404,
        headers: {
          "Cache-Control": CACHE_CONTROL,
        },
      },
    )
  }

  return Response.json(
    { spell },
    {
      headers: {
        "Cache-Control": CACHE_CONTROL,
      },
    },
  )
}
