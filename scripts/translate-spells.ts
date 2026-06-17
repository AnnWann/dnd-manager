import fs from "node:fs/promises"
import { Translate } from "@google-cloud/translate/build/src/v2"

const INPUT_PATH = "public/spells.v1.json"
const OUTPUT_PATH = "public/spells.pt-BR.json"

const translate = new Translate({
  key: process.env.GOOGLE_TRANSLATE_API_KEY,
})

type Spell = {
  description?: string
  higherLevelText?: string
  material?: string
  components?: string[]
  [key: string]: unknown
}

type SpellFile = {
  spells: Spell[]
  [key: string]: unknown
}

async function translateText(text: string): Promise<string> {
  if (!text.trim()) return text

  const [translated] = await translate.translate(text, {
    from: "en",
    to: "pt-BR",
    format: "text",
  })

  return Array.isArray(translated) ? translated[0] : translated
}

async function translateSpell(spell: Spell): Promise<Spell> {
  return {
    ...spell,
    description: spell.description
      ? await translateText(spell.description)
      : spell.description,

    higherLevelText: spell.higherLevelText
      ? await translateText(spell.higherLevelText)
      : spell.higherLevelText,

    material: spell.material
      ? await translateText(spell.material)
      : spell.material,

    components: spell.components,
  }
}

async function main() {
  const raw = await fs.readFile(INPUT_PATH, "utf-8")
  const data = JSON.parse(raw) as SpellFile

  const translatedSpells: Spell[] = []

  for (const [index, spell] of data.spells.entries()) {
    console.log(
      `Traduzindo ${index + 1}/${data.spells.length}: ${spell.name ?? spell.index}`,
    )

    translatedSpells.push(await translateSpell(spell))
  }

  const output: SpellFile = {
    ...data,
    generatedAt: Date.now(),
    notes: [
      ...(Array.isArray(data.notes) ? data.notes : []),
      "description, higherLevelText and material translated with Google Cloud Translation API.",
    ],
    spells: translatedSpells,
  }

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf-8")
  console.log(`Arquivo salvo em ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})