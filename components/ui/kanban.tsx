"use client";

// Adapted from the Sean0205 Kanban reference supplied by the user.
// Columns are fixed reading states; the caller owns all persistent mutations.
import * as React from "react";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  pointerWithin, rectIntersection,
  defaultDropAnimation, defaultDropAnimationSideEffects,
  type DragEndEvent, type UniqueIdentifier, type CollisionDetection,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  return pointer.length ? pointer : rectIntersection(args);
};

const ItemContext = React.createContext<{
  attributes?: ReturnType<typeof useDraggable>["attributes"];
  listeners?: ReturnType<typeof useDraggable>["listeners"];
  setActivatorNodeRef?: ReturnType<typeof useDraggable>["setActivatorNodeRef"];
  isDragging?: boolean;
}>({});

const ActiveContext = React.createContext<UniqueIdentifier | null>(null);

export function Kanban({ children, className, onMove }: {
  children: React.ReactNode;
  className?: string;
  onMove: (id: string, column: string) => void;
}) {
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor),
  );
  function handleEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (over && typeof over.data.current?.column === "string")
      onMove(String(active.id), over.data.current.column);
  }
  return (
    <ActiveContext.Provider value={activeId}>
      <DndContext sensors={sensors} collisionDetection={collisionDetection}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragCancel={() => setActiveId(null)} onDragEnd={handleEnd}>
        <div data-slot="kanban" data-dragging={activeId !== null} className={cn(className)}>{children}</div>
      </DndContext>
    </ActiveContext.Provider>
  );
}

export function KanbanBoard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div data-slot="kanban-board" className={cn("grid auto-rows-fr gap-4 sm:grid-cols-3", className)}>{children}</div>;
}

export function KanbanColumn({ value, children, className }: {
  value: string; children: React.ReactNode; className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "column:" + value, data: { column: value } });
  return <section ref={setNodeRef} data-slot="kanban-column" data-value={value}
    data-over={isOver} className={cn("group/kanban-column flex min-w-0 flex-col", className)}>{children}</section>;
}

export function KanbanColumnContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div data-slot="kanban-column-content" className={cn("flex flex-1 flex-col gap-2", className)}>{children}</div>;
}

export function KanbanItem({ value, children, className, disabled }: {
  value: string; children: React.ReactNode; className?: string; disabled?: boolean;
}) {
  const { setNodeRef, setActivatorNodeRef, transform, attributes, listeners, isDragging } = useDraggable({ id: value, disabled });
  return (
    <ItemContext.Provider value={{ attributes, listeners, setActivatorNodeRef, isDragging }}>
      <div data-slot="kanban-item" data-value={value} data-dragging={isDragging} ref={setNodeRef}
        style={{ transform: isDragging ? undefined : CSS.Translate.toString(transform) }}
        className={cn(isDragging && "opacity-40", className)}>{children}</div>
    </ItemContext.Provider>
  );
}

export function KanbanItemHandle({ children, label, disabled }: {
  children: React.ReactNode; label: string; disabled?: boolean;
}) {
  const { attributes, listeners, setActivatorNodeRef, isDragging } = React.useContext(ItemContext);
  return <button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners}
    aria-label={label} disabled={disabled} data-slot="kanban-item-handle"
    className={cn("touch-none rounded p-1 text-muted-foreground focus-visible:outline-2", isDragging ? "cursor-grabbing" : "cursor-grab")}>{children}</button>;
}

export function KanbanOverlay({ children }: { children: (id: string) => React.ReactNode }) {
  const id = React.useContext(ActiveContext);
  return <DragOverlay dropAnimation={{ ...defaultDropAnimation, sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0.4" } } }) }}>
    {id !== null ? <div className="pointer-events-none cursor-grabbing">{children(String(id))}</div> : null}
  </DragOverlay>;
}