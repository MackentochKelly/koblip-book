"use client"

import { createContext, useContext } from "react"

// A test of the home page with less colour (/calm): only the hero and the
// last call to action keep the colour wash; the pictures and the demo sit
// on the plain muted surface. Remove once one look is picked.
const CalmHome = createContext(false)

export function CalmHomeProvider({ children }: { children: React.ReactNode }) {
  return <CalmHome value>{children}</CalmHome>
}

export function useCalmHome(): boolean {
  return useContext(CalmHome)
}
