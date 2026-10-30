"use client"

import { createContext, useContext } from "react"

// Tests of the home page with less colour, to compare with "/" (which is
// "colour": a colour wash on every picture and panel). Only the hero and
// the last call to action keep the wash in both tests.
// "calm" (/calm): the pictures and the demo on the plain muted surface.
// "glow" (/glow): on the page colour with one soft brand glow.
// Remove once one look is picked.
export type HomeLook = "colour" | "calm" | "glow"

const Look = createContext<HomeLook>("colour")

export function HomeLookProvider({
  look,
  children,
}: {
  look: HomeLook
  children: React.ReactNode
}) {
  return <Look value={look}>{children}</Look>
}

export function useHomeLook(): HomeLook {
  return useContext(Look)
}
