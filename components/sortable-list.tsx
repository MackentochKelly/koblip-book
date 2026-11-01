"use client"

import {
  type Announcements,
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useReducedMotion } from "motion/react"
import { useId } from "react"

import { Button } from "@/components/ui/button"
import { GripVerticalIcon } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

// A list the owner reorders by dragging each row's handle, with a mouse, a
// finger or the keyboard (Space to pick up, arrows to move, Space to drop,
// Esc to cancel), each step read out to screen readers. Built on dnd-kit's
// sortable preset, as shadcn's dashboard block is
// (docs.dndkit.com/presets/sortable).
export function SortableList<Id extends string>({
  ids,
  onReorder,
  handleLabel,
  announcements,
  instructions,
  className,
  children,
}: {
  ids: Id[]
  onReorder: (ids: Id[]) => void
  // The drag handle's name for screen readers, e.g. "Move Numbers".
  handleLabel: (id: Id) => string
  // What screen readers hear while a row moves, in the page's language.
  announcements: Announcements
  instructions: string
  className?: string
  // Each row, given its drag handle to place.
  children: (id: Id, handle: React.ReactNode) => React.ReactNode
}) {
  // A fixed id, so the server and the browser draw the same markup.
  const id = useId()
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id as Id)
    const to = ids.indexOf(over.id as Id)
    onReorder(arrayMove(ids, from, to))
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{
        announcements,
        screenReaderInstructions: { draggable: instructions },
      }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {ids.map((item) => (
            <SortableRow key={item} id={item} label={handleLabel(item)}>
              {(handle) => children(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: (handle: React.ReactNode) => React.ReactNode
}) {
  // Reduce Motion: rows jump into place instead of sliding.
  const still = useReducedMotion()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: still ? null : undefined })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      className={cn("relative", isDragging && "z-10 opacity-80")}
    >
      {children(
        // The row is picked up here (it also takes keyboard focus).
        <Button
          type="button"
          variant="ghost"
          size="icon"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={label}
          className="cursor-grab touch-none active:cursor-grabbing"
        >
          <GripVerticalIcon />
        </Button>
      )}
    </div>
  )
}
