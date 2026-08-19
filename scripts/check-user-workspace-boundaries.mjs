import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const scanRoots = [
  "src/features/characters",
]

const explicitSharedFiles = [
  "src/views/CharacterView.tsx",
]

// These files are deliberately session-only. They may depend on CharacterContext
// because they are mounted only below CharacterProvider/SessionCharacterWorkspace.
const campaignOnlyAllowlist = new Set([
  "src/features/characters/characterSelector.tsx",
  "src/features/characters/characterSheet/masterConcentrationAlerts.tsx",
  "src/features/characters/customSystems/MasterAbilityAcquisitionExceptions.tsx",
  "src/features/characters/workspace/SessionCharacterWorkspace.tsx",
])

const candidates = new Set(explicitSharedFiles)
for (const scanRoot of scanRoots) {
  await collectSourceFiles(path.join(root, scanRoot), scanRoot, candidates)
}

const violations = []
for (const relativePath of [...candidates].sort()) {
  if (campaignOnlyAllowlist.has(relativePath)) continue

  const source = await readFile(path.join(root, relativePath), "utf8")
  const importsCharacterContext = /contexts[\\/]characterContext/.test(source)
  const usesLegacyHook = /\buseCharacterContext\b/.test(source)

  if (importsCharacterContext && usesLegacyHook) {
    violations.push(relativePath)
  }
}

if (violations.length > 0) {
  console.error(
    "Shared character UI must use CharacterWorkspace instead of useCharacterContext.",
  )
  for (const violation of violations) {
    console.error(` - ${violation}`)
  }
  console.error(
    "If a file is truly session-only, document that invariant and add it to the explicit allowlist.",
  )
  process.exitCode = 1
}

async function collectSourceFiles(absoluteDir, relativeDir, output) {
  const entries = await readdir(absoluteDir, { withFileTypes: true })

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name)
    const absolutePath = path.join(absoluteDir, entry.name)

    if (entry.isDirectory()) {
      await collectSourceFiles(absolutePath, relativePath, output)
      continue
    }

    if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      output.add(relativePath)
    }
  }
}
