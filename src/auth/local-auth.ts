export type LocalUser = {
  id: string
  name: string
  email: string
}

export type LocalCharacter = {
  id: string
  name: string
  visibility: "PRIVATE" | "PARTY" | "MASTER"
  data: Record<string, unknown>
  createdAt: string
  updatedAt: string
  campaigns: Array<{
    id: string
    name: string
  }>
}

const LOCAL_USER_KEY = "dnd-manager.local-user"
const LOCAL_CHARACTERS_KEY = "dnd-manager.local-characters"

export const LOCAL_AUTH_BYPASS =
  import.meta.env.DEV &&
  import.meta.env.VITE_LOCAL_AUTH_BYPASS === "true"

export function createLocalDevelopmentSession(): LocalUser {
  const existingUser = getLocalUser()

  if (existingUser) {
    ensureLocalCharacters()
    return existingUser
  }

  const user: LocalUser = {
    id: "local-development-user",
    name: "Usuário local",
    email: "local@development.test",
  }

  window.localStorage.setItem(
    LOCAL_USER_KEY,
    JSON.stringify(user),
  )

  ensureLocalCharacters()

  return user
}

export function getLocalUser(): LocalUser | null {
  if (!LOCAL_AUTH_BYPASS) return null

  try {
    const raw = window.localStorage.getItem(LOCAL_USER_KEY)

    if (!raw) return null

    return JSON.parse(raw) as LocalUser
  } catch {
    return null
  }
}

export function getLocalCharacters(): LocalCharacter[] {
  if (!LOCAL_AUTH_BYPASS) return []

  try {
    const raw = window.localStorage.getItem(
      LOCAL_CHARACTERS_KEY,
    )

    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown

    return Array.isArray(parsed)
      ? (parsed as LocalCharacter[])
      : []
  } catch {
    return []
  }
}

export function setLocalCharacters(
  characters: LocalCharacter[],
): void {
  if (!LOCAL_AUTH_BYPASS) return

  window.localStorage.setItem(
    LOCAL_CHARACTERS_KEY,
    JSON.stringify(characters),
  )
}

export function clearLocalDevelopmentSession(): void {
  window.localStorage.removeItem(LOCAL_USER_KEY)
  window.localStorage.removeItem(LOCAL_CHARACTERS_KEY)
}

function ensureLocalCharacters(): void {
  const existing = getLocalCharacters()

  if (existing.length > 0) return

  const now = new Date().toISOString()

  const characters: LocalCharacter[] = [
    {
      id: "local-character-1",
      name: "Personagem local",
      visibility: "PRIVATE",
      data: {
        id: "local-character-1",
        name: "Personagem local",
      },
      createdAt: now,
      updatedAt: now,
      campaigns: [],
    },
  ]

  setLocalCharacters(characters)
}