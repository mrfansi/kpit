"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
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
      className={isDragging ? "bg-paper-2 opacity-60" : undefined}
    >
      <TableCell className="w-10 pl-0">
        {/* Tampak 32px, area klik 44px lewat ::after milik Button. */}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Seret untuk mengubah urutan ${kpi.name}`}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden />
        </Button>
      </TableCell>
      <TableCell className="min-w-32 font-semibold whitespace-normal">{kpi.name}</TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">{domainName}</TableCell>
      <TableCell className="hidden sm:table-cell">{kpi.unit}</TableCell>
      <TableCell className="num hidden text-right sm:table-cell">{kpi.target}</TableCell>
      <TableCell className="hidden capitalize lg:table-cell">{kpi.period}</TableCell>
      <TableCell className="hidden capitalize text-muted-foreground lg:table-cell">{kpi.refreshType}</TableCell>
      <TableCell className="pr-0 text-right">
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/admin/kpi/${kpi.id}/targets`} aria-label="Atur target per periode" title="Atur target per periode">
              <Target aria-hidden />
            </Link>
          </Button>
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/admin/kpi/${kpi.id}/edit`} aria-label="Edit KPI" title="Edit KPI">
              <Pencil aria-hidden />
            </Link>
          </Button>
          <ArchiveKPIButton id={kpi.id} name={kpi.name} />
        </div>
      </TableCell>
    </TableRow>
  );
}

export function SortableKPITable({ kpis: initialKpis, domainMap }: SortableKPITableProps) {
  const dndId = useId();
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

    // Snapshot for rollback if the server write fails.
    const prevKpis = kpis;
    setKpis(newKpis);

    // Persist to DB
    const updates = newDomainKpis.map((k, i) => ({ id: k.id, sortOrder: i }));
    startTransition(async () => {
      try {
        await bulkReorderKPIs(updates);
      } catch {
        setKpis(prevKpis);
        toast.error("Gagal menyimpan urutan. Perubahan dibatalkan.");
      }
    });
  }

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <Table className={isPending ? "pointer-events-none opacity-70" : undefined}>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-0"><span className="sr-only">Urutan</span></TableHead>
            <TableHead>Nama KPI</TableHead>
            <TableHead className="hidden md:table-cell">Domain</TableHead>
            <TableHead className="hidden sm:table-cell">Unit</TableHead>
            <TableHead className="hidden text-right sm:table-cell">Target</TableHead>
            <TableHead className="hidden lg:table-cell">Periode</TableHead>
            <TableHead className="hidden lg:table-cell">Tipe</TableHead>
            <TableHead className="pr-0 text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        {[...domainGroups.entries()].map(([domainId, domainKpis]) => (
          <SortableContext
            key={domainId}
            items={domainKpis.map((k) => k.id)}
            strategy={verticalListSortingStrategy}
          >
            <TableBody className="border-b last:border-b-0">
              {domainKpis.map((kpi) => (
                <SortableRow
                  key={kpi.id}
                  kpi={kpi}
                  domainName={domainMap[kpi.domainId] ?? "-"}
                />
              ))}
            </TableBody>
          </SortableContext>
        ))}
      </Table>
    </DndContext>
  );
}
