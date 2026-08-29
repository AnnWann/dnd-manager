import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Defina POSTGRES_URL, POSTGRES_PRISMA_URL ou DATABASE_URL.')
  process.exit(1)
}

function splitSqlStatements(source) {
  const statements = []
  let current = ''
  let singleQuoted = false
  let doubleQuoted = false
  let lineComment = false
  let blockComment = false
  let dollarTag = null

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1]

    if (lineComment) {
      current += char
      if (char === '\n') lineComment = false
      continue
    }

    if (blockComment) {
      current += char
      if (char === '*' && next === '/') {
        current += next
        index += 1
        blockComment = false
      }
      continue
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, index)) {
        current += dollarTag
        index += dollarTag.length - 1
        dollarTag = null
      } else {
        current += char
      }
      continue
    }

    if (singleQuoted) {
      current += char
      if (char === "'" && next === "'") {
        current += next
        index += 1
      } else if (char === "'") {
        singleQuoted = false
      }
      continue
    }

    if (doubleQuoted) {
      current += char
      if (char === '"' && next === '"') {
        current += next
        index += 1
      } else if (char === '"') {
        doubleQuoted = false
      }
      continue
    }

    if (char === '-' && next === '-') {
      current += `${char}${next}`
      index += 1
      lineComment = true
      continue
    }

    if (char === '/' && next === '*') {
      current += `${char}${next}`
      index += 1
      blockComment = true
      continue
    }

    if (char === "'") {
      current += char
      singleQuoted = true
      continue
    }

    if (char === '"') {
      current += char
      doubleQuoted = true
      continue
    }

    if (char === '$') {
      const match = source.slice(index).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)
      if (match) {
        dollarTag = match[0]
        current += dollarTag
        index += dollarTag.length - 1
        continue
      }
    }

    if (char === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      continue
    }

    current += char
  }

  const trailing = current.trim()
  if (trailing) statements.push(trailing)
  return statements
}

const sql = neon(databaseUrl)
const migrationsDirectory = path.resolve('database/migrations')
const files = (await fs.readdir(migrationsDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort()

await sql`
  CREATE TABLE IF NOT EXISTS dndmm_schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`

for (const filename of files) {
  const applied = await sql`
    SELECT 1
    FROM dndmm_schema_migrations
    WHERE filename = ${filename}
  `
  if (applied.length) {
    console.log(`skip ${filename}`)
    continue
  }

  const source = await fs.readFile(path.join(migrationsDirectory, filename), 'utf8')
  const statements = splitSqlStatements(source)
  console.log(`apply ${filename} (${statements.length} statements)`)
  await sql.transaction([
    ...statements.map((statement) => sql.query(statement)),
    sql`INSERT INTO dndmm_schema_migrations (filename) VALUES (${filename})`,
  ])
}

console.log('Migrations concluídas.')
