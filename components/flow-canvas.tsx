"use client"

import "@xyflow/react/dist/style.css"

import {
  Background,
  Handle,
  Panel,
  Position,
  ReactFlow,
  useReactFlow,
  useStore,
  useViewport,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import { useTheme } from "next-themes"
import { useMemo } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MaximizeIcon, MinusIcon, PlusIcon } from "@/components/ui/icons"
import { Slider } from "@/components/ui/slider"

const HANDLE = "size-2.5! border-border! bg-secondary!"
const MOVE_MS = 300

export type FlowCanvasStep = {
  id: string
  position: { x: number; y: number }
  icon: React.ReactNode
  title: string
  summary: string
  kind: string
  // A trigger starts the flow: nothing comes into it.
  start?: boolean
  // Named ways out, one row each. Without them a step has one way out, when
  // `next` says so.
  outputs?: { id: string; label: string }[]
  next?: boolean
}

export type FlowCanvasLink = {
  from: string
  // The named way out it leaves by.
  output?: string
  to: string
}

export type FlowCanvasLabels = {
  zoomOut: string
  zoomIn: string
  resetZoom: string
  fit: string
}

type StepNode = Node<FlowCanvasStep, "step">

function Step({ data }: NodeProps<StepNode>) {
  return (
    <Card size="sm" className="w-64 cursor-pointer gap-2 overflow-visible py-3 text-left transition-colors hover:ring-muted-foreground">
      {!data.start && <Handle type="target" position={Position.Left} className={HANDLE} />}
      <div className="flex items-center gap-2 px-3 font-medium [&_svg]:size-4 [&_svg]:shrink-0">
        {data.icon}
        <span className="min-w-0 truncate">{data.title}</span>
      </div>
      <p className="line-clamp-2 px-3 text-muted-foreground">{data.summary}</p>
      <div className="px-3">
        <Badge variant="secondary">{data.kind}</Badge>
      </div>
      {data.next && <Handle type="source" position={Position.Right} className={HANDLE} />}
      {data.outputs && data.outputs.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          {data.outputs.map((output) => (
            <div key={output.id} className="relative px-3 text-right text-xs">
              {output.label}
              <Handle id={output.id} type="source" position={Position.Right} className={HANDLE} />
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// Declared outside the component, as React Flow asks, so steps never remount.
const NODE_TYPES = { step: Step }

// Zoom out, a slider, zoom in, the zoom as a percent (back to 100%) and fit.
// Phones pinch instead.
function ZoomBar({ labels }: { labels: FlowCanvasLabels }) {
  const { zoom } = useViewport()
  const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow()
  const minZoom = useStore((state) => state.minZoom)
  const maxZoom = useStore((state) => state.maxZoom)
  return (
    <Panel
      position="top-left"
      className="hidden items-center gap-1 rounded-4xl bg-card p-1 shadow-card ring-1 ring-border md:flex"
    >
      <Button variant="ghost" size="icon" aria-label={labels.zoomOut} onClick={() => zoomOut({ duration: MOVE_MS })}>
        <MinusIcon />
      </Button>
      <div className="w-24">
        <Slider
          value={[zoom]}
          min={minZoom}
          max={maxZoom}
          step={0.01}
          aria-label={labels.resetZoom}
          onValueChange={(value) => zoomTo((value as number[])[0])}
        />
      </div>
      <Button variant="ghost" size="icon" aria-label={labels.zoomIn} onClick={() => zoomIn({ duration: MOVE_MS })}>
        <PlusIcon />
      </Button>
      <Button
        variant="ghost"
        className="w-16 tabular-nums"
        aria-label={labels.resetZoom}
        onClick={() => zoomTo(1, { duration: MOVE_MS })}
      >
        {Math.round(zoom * 100)}%
      </Button>
      <Button variant="ghost" size="icon" aria-label={labels.fit} onClick={() => fitView({ duration: MOVE_MS })}>
        <MaximizeIcon />
      </Button>
    </Panel>
  )
}

// A flow drawn left to right on a dotted canvas: steps and the lines between
// them, to pan and zoom. Tapping a step opens it.
export function FlowCanvas({
  label,
  steps,
  links,
  labels,
  onOpenStep,
}: {
  label: string
  steps: FlowCanvasStep[]
  links: FlowCanvasLink[]
  labels: FlowCanvasLabels
  onOpenStep: (id: string) => void
}) {
  const { resolvedTheme } = useTheme()
  const nodes = useMemo<StepNode[]>(
    () => steps.map((step) => ({ id: step.id, type: "step", position: step.position, data: step })),
    [steps]
  )
  const edges = useMemo<Edge[]>(
    () =>
      links.map((link) => ({
        id: `${link.from}:${link.output ?? "next"}:${link.to}`,
        source: link.from,
        sourceHandle: link.output,
        target: link.to,
      })),
    [links]
  )
  return (
    <ReactFlow
      aria-label={label}
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      colorMode={resolvedTheme === "dark" ? "dark" : "light"}
      onNodeClick={(_, node) => onOpenStep(node.id)}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      minZoom={0.25}
      maxZoom={1.5}
    >
      <Background bgColor="var(--background)" color="var(--muted-foreground)" />
      <ZoomBar labels={labels} />
    </ReactFlow>
  )
}
