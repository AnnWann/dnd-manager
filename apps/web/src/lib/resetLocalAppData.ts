const APP_STORAGE_PREFIX = "dndmm."

function clearStorage(storage: Storage): void {
  const keys: string[] = []

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index)
    if (key?.startsWith(APP_STORAGE_PREFIX)) keys.push(key)
  }

  for (const key of keys) storage.removeItem(key)
}

export async function resetLocalAppData(): Promise<void> {
  clearStorage(window.localStorage)
  clearStorage(window.sessionStorage)

  try {
    if ("caches" in window) {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)))
    }
  } catch {
    // Cache cleanup is best-effort. Storage cleanup is the important part.
  }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // The app can still reset correctly when service workers are unavailable.
  }

  const nextUrl = new URL("/sync", window.location.origin)
  window.location.replace(nextUrl.toString())
}

export function confirmAndResetLocalAppData(): void {
  const confirmed = window.confirm(
    "Isso apagará neste dispositivo o estado local, a chave de sincronização, o nome do jogador e o papel selecionado. Os dados salvos no servidor não serão apagados. Continuar?",
  )

  if (!confirmed) return
  void resetLocalAppData()
}
