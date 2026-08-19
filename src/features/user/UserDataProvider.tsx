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

import { getMyCampaigns, type UserCampaign } from "../../api/user-campaigns"
import { getMyCharacters, type UserCharacterSummary } from "../../api/user-characters"
import { authClient } from "../../auth/auth-client"
import { getLocalUser, LOCAL_AUTH_BYPASS } from "../../auth/local-auth"
import { readUserCache, writeUserCache } from "./userPersistentCache"

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

const UserDataContext = createContext<UserDataState | null>(null)

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession()
  const localUser = LOCAL_AUTH_BYPASS ? getLocalUser() : null
  const userId = session?.user?.id ?? localUser?.id ?? ""

  const [characters, setCharactersState] = useState<UserCharacterSummary[]>([])
  const [campaigns, setCampaignsState] = useState<UserCampaign[]>([])
  const [charactersLoading, setCharactersLoading] = useState(true)
  const [campaignsLoading, setCampaignsLoading] = useState(true)
  const [charactersRefreshing, setCharactersRefreshing] = useState(false)
  const [campaignsRefreshing, setCampaignsRefreshing] = useState(false)
  const [charactersError, setCharactersError] = useState("")
  const [campaignsError, setCampaignsError] = useState("")

  const setCharacters: Dispatch<SetStateAction<UserCharacterSummary[]>> = useCallback(
    (next) => {
      setCharactersState((current) => {
        const resolved = typeof next === "function" ? next(current) : next
        if (userId) writeUserCache(userId, "characters", resolved)
        return resolved
      })
    },
    [userId],
  )

  const setCampaigns: Dispatch<SetStateAction<UserCampaign[]>> = useCallback(
    (next) => {
      setCampaignsState((current) => {
        const resolved = typeof next === "function" ? next(current) : next
        if (userId) writeUserCache(userId, "campaigns", resolved)
        return resolved
      })
    },
    [userId],
  )

  const refreshCharacters = useCallback(async () => {
    if (!userId) return
    setCharactersRefreshing(true)
    setCharactersError("")
    try {
      const next = await getMyCharacters()
      setCharacters(next)
    } catch {
      setCharactersError("Não foi possível atualizar seus personagens.")
    } finally {
      setCharactersRefreshing(false)
      setCharactersLoading(false)
    }
  }, [setCharacters, userId])

  const refreshCampaigns = useCallback(async () => {
    if (!userId) return
    setCampaignsRefreshing(true)
    setCampaignsError("")
    try {
      const next = await getMyCampaigns()
      setCampaigns(next)
    } catch {
      setCampaignsError("Não foi possível atualizar suas campanhas.")
    } finally {
      setCampaignsRefreshing(false)
      setCampaignsLoading(false)
    }
  }, [setCampaigns, userId])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshCharacters(), refreshCampaigns()])
  }, [refreshCampaigns, refreshCharacters])

  useEffect(() => {
    if (!userId) return

    const cachedCharacters = readUserCache<UserCharacterSummary[]>(userId, "characters")
    const cachedCampaigns = readUserCache<UserCampaign[]>(userId, "campaigns")

    setCharactersState(cachedCharacters ?? [])
    setCampaignsState(cachedCampaigns ?? [])
    setCharactersLoading(!cachedCharacters)
    setCampaignsLoading(!cachedCampaigns)

    void refreshAll()
  }, [refreshAll, userId])

  const value = useMemo<UserDataState>(
    () => ({
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
    }),
    [
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
    ],
  )

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData(): UserDataState {
  const context = useContext(UserDataContext)
  if (!context) {
    throw new Error("useUserData precisa estar dentro de UserDataProvider.")
  }
  return context
}
