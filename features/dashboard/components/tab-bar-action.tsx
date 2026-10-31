"use client"

import { createContext, use, useEffect, useRef } from "react"

export interface TabBarAction {
  label: string
  onClick: () => void
  disabled?: boolean
}

// The phone tab bar's middle button: the assistant, unless the open page
// gives it an add action (Services, Team, Customers), which turns it into +.
// The shell holds the action; pages set it with useTabBarAction.
export const TabBarActionContext = createContext<
  (action: TabBarAction | null) => void
>(() => {})

// Gives the tab bar's middle button this page's add action while the page
// is open; null leaves it the assistant. The latest onClick always runs.
export function useTabBarAction(action: TabBarAction | null) {
  const setAction = use(TabBarActionContext)
  const latest = useRef(action)
  useEffect(() => {
    latest.current = action
  })
  const shown = action !== null
  const label = action?.label
  const disabled = action?.disabled
  useEffect(() => {
    if (!shown || label === undefined) {
      setAction(null)
      return
    }
    setAction({ label, disabled, onClick: () => latest.current?.onClick() })
    return () => setAction(null)
  }, [setAction, shown, label, disabled])
}
