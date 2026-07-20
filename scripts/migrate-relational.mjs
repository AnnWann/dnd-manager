import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Defina POSTGRES_URL, POSTGRES_PRISMA_URL ou DATABASE_URL.')
  process.exit(1)
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
  console.log(`apply ${filename}`)
  await sql.transaction([
    sql.query(source),
    sql`INSERT INTO dndmm_schema_migrations (filename) VALUES (${filename})`,
  ])
}

console.log('Migrations concluídas.')
