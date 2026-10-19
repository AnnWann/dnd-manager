import { createContext, useContext, type ReactNode } from "react"

/** Host-neutral provider factory. The website retains its domain types while VTT
 * hosts can define their own operation and projection contracts.
 */
export function createCharacterWorkspaceBridge<T extends object>(name = "CharacterWorkspace") {
  const Context = createContext<T | null>(null)
  function Provider({ value, children }: { value: T; children: ReactNode }) {
    return <Context.Provider value={value}>{children}</Context.Provider>
  }
  function useWorkspace(): T {
    const value = useContext(Context)
    if (!value) throw new Error(`${name} requires its provider`)
    return value
  }
  function useOptionalWorkspace(): T | null {
    return useContext(Context)
  }
  return { Provider, useWorkspace, useOptionalWorkspace, Context }
}
