import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { useLocation } from "react-router-dom"

import { getMyCampaigns, type UserCampaign } from "../../api/user-campaigns"
import { getMyCharacters, type UserCharacterSummary } from "../../api/user-characters"
import { authClient } from "../../auth/auth-client"
import { getLocalUser, LOCAL_AUTH_BYPASS } from "../../auth/local-auth"
import {
  readUserCacheSnapshot,
  setActiveUserCacheId,
  writeUserCache,
} from "./userPersistentCache"

type UserDataState = {
  userId: string
  characters: UserCharacterSummary[]
  campaigns: UserCampaign[]
  charactersLoading: boolean
  campaignsLoading: boolean
  charactersRefreshing: boolean
  campaignsRefreshing: boolean
  charactersError: string
  campaignsError: string
  setCharacters: Dispatch<SetStateAction<UserCharacterSummary[]>>
  setCampaigns: Dispatch<SetStateAction<UserCampaign[]>>
  refreshCharacters: () => Promise<void>
  refreshCampaigns: () => Promise<void>
  refreshAll: () => Promise<void>
}

type UserDataRequirements = {
  characters: boolean
  campaigns: boolean
}

const UserDataContext = createContext<UserDataState | null>(null)
const charactersRequests = new Map<string, Promise<UserCharacterSummary[]>>()
const campaignsRequests = new Map<string, Promise<UserCampaign[]>>()

function fetchCharactersOnce(userId: string): Promise<UserCharacterSummary[]> {
  const existing = charactersRequests.get(userId)
  if (existing) return existing
  const request = getMyCharacters().finally(() => {
    if (charactersRequests.get(userId) === request) charactersRequests.delete(userId)
  })
  charactersRequests.set(userId, request)
  return request
}

function fetchCampaignsOnce(userId: string): Promise<UserCampaign[]> {
  const existing = campaignsRequests.get(userId)
  if (existing) return existing
  const request = getMyCampaigns().finally(() => {
    if (campaignsRequests.get(userId) === request) campaignsRequests.delete(userId)
  })
  campaignsRequests.set(userId, request)
  return request
}

function requirementsForPath(pathname: string): UserDataRequirements {
  if (pathname === "/user" || pathname.startsWith("/user/characters")) {
    return { characters: true, campaigns: false }
  }
  if (pathname.startsWith("/user/campaigns")) {
    return { characters: true, campaigns: true }
  }
  if (pathname.startsWith("/user/spells")) {
    return { characters: false, campaigns: true }
  }
  return { characters: false, campaigns: false }
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const requirements = requirementsForPath(location.pathname)
  const { data: session } = authClient.useSession()
  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const userId = session?.user?.id ?? localUser?.id ?? ""

  setActiveUserCacheId(userId)

  const [characters, setCharactersState] = useState<UserCharacterSummary[]>([])
  const [campaigns, setCampaignsState] = useState<UserCampaign[]>([])
  const [charactersLoading, setCharactersLoading] = useState(true)
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [charactersRefreshing, setCharactersRefreshing] = useState(false)
  const [campaignsRefreshing, setCampaignsRefreshing] = useState(false)
  const [charactersError, setCharactersError] = useState("")
  const [campaignsError, setCampaignsError] = useState("")

  const setCharacters: Dispatch<SetStateAction<UserCharacterSummary[]>> = useCallback((next) => {
    setCharactersState((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      if (userId) writeUserCache(userId, "characters", resolved)
      return resolved
    })
  }, [userId])

  const setCampaigns: Dispatch<SetStateAction<UserCampaign[]>> = useCallback((next) => {
    setCampaignsState((current) => {
      const resolved = typeof next === "function" ? next(current) : next
      if (userId) writeUserCache(userId, "campaigns", resolved)
      return resolved
    })
  }, [userId])

  const refreshCharacters = useCallback(async () => {
    if (!userId) return
    setCharactersRefreshing(true)
    setCharactersError("")
    try {
      const next = await fetchCharactersOnce(userId)
      setCharactersState(next)
      writeUserCache(userId, "characters", next, { synced: true })
    } catch {
      setCharactersError("Não foi possível atualizar seus personagens.")
    } finally {
      setCharactersRefreshing(false)
      setCharactersLoading(false)
    }
  }, [userId])

  const refreshCampaigns = useCallback(async () => {
    if (!userId) return
    setCampaignsRefreshing(true)
    setCampaignsError("")
    try {
      const next = await fetchCampaignsOnce(userId)
      setCampaignsState(next)
      writeUserCache(userId, "campaigns", next, { synced: true })
    } catch {
      setCampaignsError("Não foi possível atualizar suas campanhas.")
    } finally {
      setCampaignsRefreshing(false)
      setCampaignsLoading(false)
    }
  }, [userId])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCharacters(), refreshCampaigns()])
  }, [refreshCampaigns, refreshCharacters])

  useEffect(() => {
    if (!userId) return
    const cachedCharacters = readUserCacheSnapshot<UserCharacterSummary[]>(userId, "characters")
    const cachedCampaigns = readUserCacheSnapshot<UserCampaign[]>(userId, "campaigns")

    setCharactersState(cachedCharacters?.data ?? [])
    setCampaignsState(cachedCampaigns?.data ?? [])
    setCharactersLoading(!cachedCharacters)
    setCampaignsLoading(!cachedCampaigns)

    if (requirements.characters && (!cachedCharacters || !cachedCharacters.fresh)) {
      void refreshCharacters()
    }
    if (requirements.campaigns && (!cachedCampaigns || !cachedCampaigns.fresh)) {
      void refreshCampaigns()
    }
  }, [
    refreshCampaigns,
    refreshCharacters,
    requirements.campaigns,
    requirements.characters,
    userId,
  ])

  const value = useMemo<UserDataState>(() => ({
    userId,
    characters,
    campaigns,
    charactersLoading,
    campaignsLoading,
    charactersRefreshing,
    campaignsRefreshing,
    charactersError,
    campaignsError,
    setCharacters,
    setCampaigns,
    refreshCharacters,
    refreshCampaigns,
    refreshAll,
  }), [
    campaigns,
    campaignsError,
    campaignsLoading,
    campaignsRefreshing,
    characters,
    charactersError,
    charactersLoading,
    charactersRefreshing,
    refreshAll,
    refreshCampaigns,
    refreshCharacters,
    setCampaigns,
    setCharacters,
    userId,
  ])

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData(): UserDataState {
  const context = useContext(UserDataContext)
  if (!context) throw new Error("useUserData precisa estar dentro de UserDataProvider.")
  return context
}
