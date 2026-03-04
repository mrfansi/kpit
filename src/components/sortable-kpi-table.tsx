"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { KPI } from "@/lib/db/schema";
import { bulkReorderKPIs } from "@/lib/actions/kpi";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveKPIButton } from "@/components/archive-kpi-button";
import { GripVertical, Pencil, Target } from "lucide-react";
import Link from "next/link";

interface SortableKPITableProps {
  kpis: KPI[];
  domainMap: Record<number, string>;
}

function SortableRow({ kpi, domainName }: { kpi: KPI; domainName: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: kpi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-50 bg-muted" : undefined}
    >
      <TableCell className="w-10">
        <button
          className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </TableCell>
      <TableCell className="font-medium">{kpi.name}</TableCell>
      <TableCell>
        <span className="text-sm">{domainName}</span>
      </TableCell>
      <TableCell>{kpi.unit}</TableCell>
      <TableCell className="text-right">{kpi.target}</TableCell>
      <TableCell className="capitalize">{kpi.period}</TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize">{kpi.refreshType}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button variant="ghost" size="icon" asChild title="Atur target per periode">
            <Link href={`/admin/kpi/${kpi.id}/targets`}>
              <Target className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/kpi/${kpi.id}/edit`}>
              <Pencil className="w-4 h-4" />
            </Link>
          </Button>
          <ArchiveKPIButton id={kpi.id} name={kpi.name} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SortableKPITable({ kpis: initialKpis, domainMap }: SortableKPITableProps) {
  const [kpis, setKpis] = useState(initialKpis);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group KPIs by domain, preserving order
  const domainGroups = new Map<number, KPI[]>();
  for (const kpi of kpis) {
    const arr = domainGroups.get(kpi.domainId) ?? [];
    arr.push(kpi);
    domainGroups.set(kpi.domainId, arr);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeKpi = kpis.find((k) => k.id === active.id);
    const overKpi = kpis.find((k) => k.id === over.id);
    if (!activeKpi || !overKpi) return;

    // Only allow reorder within the same domain
    if (activeKpi.domainId !== overKpi.domainId) return;

    const domainId = activeKpi.domainId;
    const domainKpis = domainGroups.get(domainId);
    if (!domainKpis) return;

    const oldIndex = domainKpis.findIndex((k) => k.id === active.id);
    const newIndex = domainKpis.findIndex((k) => k.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    // Reorder within domain
    const newDomainKpis = [...domainKpis];
    const [moved] = newDomainKpis.splice(oldIndex, 1);
    newDomainKpis.splice(newIndex, 0, moved);

    // Rebuild full list maintaining domain order
    const newKpis = kpis.map((k) => {
      if (k.domainId !== domainId) return k;
      const idx = newDomainKpis.findIndex((dk) => dk.id === k.id);
      return { ...k, sortOrder: idx };
    });

    // Sort by domainId then sortOrder to maintain visual order
    newKpis.sort((a, b) => a.domainId - b.domainId || a.sortOrder - b.sortOrder);
    setKpis(newKpis);

    // Persist to DB
    const updates = newDomainKpis.map((k, i) => ({ id: k.id, sortOrder: i }));
    startTransition(() => bulkReorderKPIs(updates));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <Table className={isPending ? "opacity-70 pointer-events-none" : undefined}>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10"></TableHead>
            <TableHead>Nama KPI</TableHead>
            <TableHead>Domain</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead>Periode</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        {[...domainGroups.entries()].map(([domainId, domainKpis]) => (
          <SortableContext
            key={domainId}
            items={domainKpis.map((k) => k.id)}
            strategy={verticalListSortingStrategy}
          >
            <TableBody>
              {domainKpis.map((kpi) => (
                <SortableRow
                  key={kpi.id}
                  kpi={kpi}
                  domainName={domainMap[kpi.domainId] ?? "—"}
                />
              ))}
            </TableBody>
          </SortableContext>
        ))}
      </Table>
    </DndContext>
  );
}
