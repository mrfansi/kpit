# Timeline Gantt Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add date labels on gantt bars, dynamic project statuses with settings CRUD, and a side panel for quick progress log access.

**Architecture:** Three independent features layered on existing gantt chart. Status system uses a separate DB table with FK from projects, managed via admin settings page. Progress log panel reuses existing `TimelineProgressLog` component in a slide-over panel.

**Tech Stack:** Next.js, Drizzle ORM (SQLite), Radix UI Select, Tailwind CSS, date-fns

---

## Task 1: Database — Project Statuses Table + Migration

**Files:**
- Create: `drizzle/0010_project_statuses.sql`
- Modify: `src/lib/db/schema.ts`

**Step 1: Write the migration SQL**

Create `drizzle/0010_project_statuses.sql`:

```sql
CREATE TABLE timeline_project_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#9ca3af',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Seed default statuses
INSERT INTO timeline_project_statuses (name, slug, color, sort_order) VALUES
  ('Not Started', 'not_started', '#9ca3af', 0),
  ('On-Track', 'on_track', '#3b82f6', 1),
  ('On-Hold', 'on_hold', '#f59e0b', 2),
  ('Delayed', 'delayed', '#ef4444', 3),
  ('Launched', 'launched', '#22c55e', 4);

-- Add FK column to projects (nullable, references statuses)
ALTER TABLE timeline_projects ADD COLUMN status_id INTEGER REFERENCES timeline_project_statuses(id);
```

**Step 2: Add schema definitions in `src/lib/db/schema.ts`**

Add before the `timelineProjects` table definition:

```typescript
export const timelineProjectStatuses = sqliteTable("timeline_project_statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  color: text("color").notNull().default("#9ca3af"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
});

export type TimelineProjectStatus = typeof timelineProjectStatuses.$inferSelect;
export type NewTimelineProjectStatus = typeof timelineProjectStatuses.$inferInsert;
```

Add `statusId` column to `timelineProjects`:

```typescript
statusId: integer("status_id").references(() => timelineProjectStatuses.id),
```

**Step 3: Run migration**

```bash
cd /Users/mrfansi/GitHub/mrfansi/kpit
npx drizzle-kit push
```

Expected: Migration applied, tables created, seed data inserted.

**Step 4: Commit**

```bash
git add drizzle/0010_project_statuses.sql src/lib/db/schema.ts
git commit -m "feat(timeline): add project statuses table with seed data"
```

---

## Task 2: Status Queries & Actions

**Files:**
- Create: `src/lib/queries/timeline-statuses.ts`
- Create: `src/lib/actions/timeline-statuses.ts`
- Create: `src/lib/validations/timeline-status.ts`

**Step 1: Create validation schema**

Create `src/lib/validations/timeline-status.ts`:

```typescript
import { z } from "zod";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus format hex #RRGGBB");

export const statusSchema = z.object({
  name: z.string().min(1, "Nama tidak boleh kosong").max(50),
  color: hexColor.default("#9ca3af"),
});

export type StatusFormValues = z.infer<typeof statusSchema>;
```

**Step 2: Create query functions**

Create `src/lib/queries/timeline-statuses.ts`:

```typescript
import { db } from "@/lib/db";
import { timelineProjectStatuses } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

export function getAllStatuses() {
  return db
    .select()
    .from(timelineProjectStatuses)
    .orderBy(asc(timelineProjectStatuses.sortOrder));
}
```

**Step 3: Create server actions**

Create `src/lib/actions/timeline-statuses.ts`:

```typescript
"use server";

import { db } from "@/lib/db";
import { timelineProjectStatuses, timelineProjects } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-utils";
import { logAudit } from "@/lib/db/audit";
import { statusSchema } from "@/lib/validations/timeline-status";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function revalidateAll() {
  revalidatePath("/timeline");
  revalidatePath("/admin/timeline");
  revalidatePath("/admin/timeline/statuses");
}

export async function createStatus(formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const slug = slugify(parsed.data.name);

  // Get max sortOrder
  const existing = await db
    .select({ maxOrder: count() })
    .from(timelineProjectStatuses);
  const nextOrder = (existing[0]?.maxOrder ?? 0);

  await db.insert(timelineProjectStatuses).values({
    name: parsed.data.name,
    slug,
    color: parsed.data.color,
    sortOrder: nextOrder,
    createdAt: new Date(),
  });

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "create",
    entity: "timeline_project_status",
    detail: parsed.data.name,
  });
  revalidateAll();
}

export async function updateStatus(id: number, formData: FormData) {
  const session = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const parsed = statusSchema.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const slug = slugify(parsed.data.name);

  await db
    .update(timelineProjectStatuses)
    .set({ name: parsed.data.name, slug, color: parsed.data.color })
    .where(eq(timelineProjectStatuses.id, id));

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "update",
    entity: "timeline_project_status",
    entityId: String(id),
    detail: parsed.data.name,
  });
  revalidateAll();
}

export async function deleteStatus(id: number) {
  const session = await requireAdmin();

  // Check if any project uses this status
  const usage = await db
    .select({ cnt: count() })
    .from(timelineProjects)
    .where(eq(timelineProjects.statusId, id));

  if (usage[0]?.cnt > 0) {
    throw new Error(
      `Status ini masih digunakan oleh ${usage[0].cnt} project. Ubah status project tersebut terlebih dahulu.`
    );
  }

  await db
    .delete(timelineProjectStatuses)
    .where(eq(timelineProjectStatuses.id, id));

  await logAudit({
    userId: session.user.id,
    userEmail: session.user.email ?? undefined,
    action: "delete",
    entity: "timeline_project_status",
    entityId: String(id),
  });
  revalidateAll();
}
```

**Step 4: Commit**

```bash
git add src/lib/validations/timeline-status.ts src/lib/queries/timeline-statuses.ts src/lib/actions/timeline-statuses.ts
git commit -m "feat(timeline): add status queries, actions, and validation"
```

---

## Task 3: Update Project Schema for StatusId

**Files:**
- Modify: `src/lib/validations/timeline.ts` — add `statusId`
- Modify: `src/lib/actions/timeline.ts` — persist `statusId`
- Modify: `src/lib/queries/timeline.ts` — join status in queries

**Step 1: Update validation**

In `src/lib/validations/timeline.ts`, add to the `projectSchema` object:

```typescript
statusId: z.coerce.number().int().positive().optional(),
```

**Step 2: Update createProject and updateProject actions**

In `src/lib/actions/timeline.ts`, add to the `.values()` and `.set()` calls:

```typescript
statusId: parsed.data.statusId ?? null,
```

**Step 3: Update queries to join status**

In `src/lib/queries/timeline.ts`, modify `getAllTimelineProjects` to left join `timelineProjectStatuses` and return status data alongside project data. Use Drizzle's `leftJoin` and return a flat object with status fields.

Check current query implementation first — if it uses `db.select().from()`, add `.leftJoin()`. If it uses `db.query`, add `with: { status: true }` after defining relations.

**Step 4: Commit**

```bash
git add src/lib/validations/timeline.ts src/lib/actions/timeline.ts src/lib/queries/timeline.ts
git commit -m "feat(timeline): integrate statusId into project CRUD"
```

---

## Task 4: Admin Status Settings Page

**Files:**
- Create: `src/app/admin/timeline/statuses/page.tsx`
- Modify: `src/components/sidebar.tsx` — add menu item

**Step 1: Create the settings page**

Create `src/app/admin/timeline/statuses/page.tsx`:

A server component page that:
- Fetches all statuses via `getAllStatuses()`
- Renders a table: color swatch, name, slug, project count, actions (edit/delete)
- Add form at top: name input + color picker + submit button
- Edit inline: clicking edit turns row into editable inputs
- Delete button with confirmation (disabled if projects use the status)
- Uses existing UI components: `Button`, `Input`, `Label` from `@/components/ui`

Follow the same pattern as `/admin/timeline/page.tsx` for layout and auth check (`requireAdmin()`).

**Step 2: Add sidebar navigation entry**

In `src/components/sidebar.tsx`, add a new item under the Admin section:

```typescript
{ name: "Status Timeline", href: "/admin/timeline/statuses", icon: Tags }
```

Import `Tags` from `lucide-react`.

**Step 3: Verify page loads**

```bash
# Start dev server if not running
npm run dev
# Visit http://localhost:3000/admin/timeline/statuses
```

Expected: Page loads with 5 seeded statuses, add form works.

**Step 4: Commit**

```bash
git add src/app/admin/timeline/statuses/page.tsx src/components/sidebar.tsx
git commit -m "feat(timeline): add status settings page with CRUD"
```

---

## Task 5: Gantt Bar Date Labels

**Files:**
- Modify: `src/components/gantt/gantt-chart.tsx`

**Step 1: Add date labels to project bars**

In the project bars render section (around line 292-352 of `gantt-chart.tsx`), add date labels inside the bar `div`, after the progress fill and project name:

```tsx
{/* Date labels on bar edges */}
{adjustedWidth > 120 && (
  <>
    <span
      className="absolute left-1.5 bottom-0.5 text-[9px] pointer-events-none select-none"
      style={{ color: `${project.color}90` }}
    >
      {format(parseISO(project.startDate), "dd MMM", { locale: idLocale })}
    </span>
    <span
      className="absolute right-1.5 bottom-0.5 text-[9px] pointer-events-none select-none"
      style={{ color: `${project.color}90` }}
    >
      {format(parseISO(project.endDate), "dd MMM", { locale: idLocale })}
    </span>
  </>
)}
```

**Step 2: Verify visually**

Open `/timeline` in browser. Bars wider than 120px should show dates at both ends. Narrow bars should have no dates.

**Step 3: Commit**

```bash
git add src/components/gantt/gantt-chart.tsx
git commit -m "feat(timeline): add start/end date labels on gantt bars"
```

---

## Task 6: Status Visuals on Gantt Bar + Left Panel

**Files:**
- Modify: `src/components/gantt/gantt-chart.tsx`
- Modify: `src/components/gantt/gantt-types.ts` — increase ROW_HEIGHT if needed
- Modify: `src/app/timeline/page.tsx` — pass statuses to GanttChart

**Step 1: Pass statuses data to GanttChart**

In `src/app/timeline/page.tsx`, fetch statuses and pass as prop:

```typescript
const statuses = await getAllStatuses();
// Pass to <GanttChart projects={projects} statuses={statuses} isAuthenticated={...} />
```

Update `GanttChartProps` in `gantt-chart.tsx`:

```typescript
interface GanttChartProps {
  projects: TimelineProject[];
  statuses: TimelineProjectStatus[];
  isAuthenticated: boolean;
}
```

**Step 2: Add status badge to left panel**

In the left panel project row, after the date range line, add status badge:

```tsx
{(() => {
  const status = statuses.find((s) => s.id === project.statusId);
  if (!status) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: status.color }}
      />
      <span style={{ color: status.color }}>{status.name}</span>
    </span>
  );
})()}
```

**Step 3: Apply visual hints to gantt bar**

Modify the bar `style` to incorporate status:

```typescript
const status = statuses.find((s) => s.id === project.statusId);
const barColor = status?.color ?? project.color;
const isNotStarted = status?.slug === "not_started";
const isOnHold = status?.slug === "on_hold";

// Apply to bar div style:
style={{
  left: adjustedX,
  top: y,
  width: adjustedWidth,
  height: barHeight,
  backgroundColor: `${barColor}20`,
  border: `2px ${isNotStarted ? "dashed" : "solid"} ${barColor}`,
  opacity: isNotStarted ? 0.5 : isOnHold ? 0.6 : 1,
}}
```

**Step 4: Increase ROW_HEIGHT if needed**

If adding status badge makes the left panel row feel cramped, increase `ROW_HEIGHT` from 56 to 64 in `gantt-types.ts`. Test visually.

**Step 5: Commit**

```bash
git add src/components/gantt/gantt-chart.tsx src/components/gantt/gantt-types.ts src/app/timeline/page.tsx
git commit -m "feat(timeline): add status visuals on gantt bar and left panel"
```

---

## Task 7: Status Dropdown in Project Form

**Files:**
- Modify: `src/components/timeline-project-form.tsx`

**Step 1: Add statuses prop to form dialog**

```typescript
interface TimelineProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: TimelineProject | null;
  statuses: TimelineProjectStatus[];
}
```

**Step 2: Add status select field**

After the progress field in the form, add:

```tsx
<div className="space-y-2">
  <Label htmlFor="statusId">Status</Label>
  <select
    id="statusId"
    name="statusId"
    defaultValue={project?.statusId ?? ""}
    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  >
    <option value="">— Pilih status —</option>
    {statuses.map((s) => (
      <option key={s.id} value={s.id}>
        {s.name}
      </option>
    ))}
  </select>
</div>
```

Use native `<select>` for simplicity — it works well with FormData and requires no additional state.

**Step 3: Update all call sites**

Pass `statuses` prop wherever `TimelineProjectFormDialog` is used (in `gantt-chart.tsx`).

**Step 4: Commit**

```bash
git add src/components/timeline-project-form.tsx src/components/gantt/gantt-chart.tsx
git commit -m "feat(timeline): add status dropdown in project form"
```

---

## Task 8: Progress Log Side Panel

**Files:**
- Create: `src/components/gantt/gantt-log-panel.tsx`
- Modify: `src/components/gantt/gantt-chart.tsx`

**Step 1: Create the side panel component**

Create `src/components/gantt/gantt-log-panel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TimelineProgressLog } from "@/components/timeline-progress-log";
import { fetchProjectLogs } from "@/lib/actions/timeline";
import type { TimelineProject, TimelineProjectLog } from "@/lib/db/schema";

interface GanttLogPanelProps {
  project: TimelineProject;
  onClose: () => void;
}

export function GanttLogPanel({ project, onClose }: GanttLogPanelProps) {
  const [logs, setLogs] = useState<TimelineProjectLog[]>([]);

  useEffect(() => {
    fetchProjectLogs(project.id).then(setLogs);
  }, [project.id]);

  return (
    <div className="fixed inset-y-0 right-0 w-[360px] bg-background border-l shadow-xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{project.name}</h3>
          <p className="text-xs text-muted-foreground">Progress Log</p>
        </div>
        <Button variant="ghost" size="icon" className="shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4">
        <TimelineProgressLog
          projectId={project.id}
          currentProgress={project.progress}
          initialLogs={logs}
        />
      </div>
    </div>
  );
}
```

**Step 2: Add state and icon trigger in GanttChart**

In `gantt-chart.tsx`, add state:

```typescript
const [logPanelProject, setLogPanelProject] = useState<TimelineProject | null>(null);
```

Add ClipboardList icon next to Pencil in the left panel row:

```tsx
{isAuthenticated && (
  <div className="flex items-center gap-0.5 shrink-0">
    <button
      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
      onClick={() => setLogPanelProject(project)}
      title="Progress Log"
    >
      <ClipboardList className="w-3 h-3 text-muted-foreground" />
    </button>
    <button
      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1 rounded hover:bg-accent"
      onClick={() => {
        setEditingProject(project);
        setProjectDialogOpen(true);
      }}
      title="Edit project"
    >
      <Pencil className="w-3 h-3 text-muted-foreground" />
    </button>
  </div>
)}
```

Import `ClipboardList` from `lucide-react` and `GanttLogPanel` from `./gantt-log-panel`.

**Step 3: Render the panel**

At the end of the component return (after `TimelineProjectFormDialog`):

```tsx
{logPanelProject && (
  <GanttLogPanel
    project={logPanelProject}
    onClose={() => setLogPanelProject(null)}
  />
)}
```

**Step 4: Add click-outside to close**

Add a backdrop overlay behind the panel:

```tsx
{logPanelProject && (
  <>
    <div
      className="fixed inset-0 z-40"
      onClick={() => setLogPanelProject(null)}
    />
    <GanttLogPanel
      project={logPanelProject}
      onClose={() => setLogPanelProject(null)}
    />
  </>
)}
```

**Step 5: Verify**

Open `/timeline`, hover a project row, click ClipboardList icon. Panel should slide in from right showing logs. Click outside or X to close.

**Step 6: Commit**

```bash
git add src/components/gantt/gantt-log-panel.tsx src/components/gantt/gantt-chart.tsx
git commit -m "feat(timeline): add progress log side panel with quick access"
```

---

## Task 9: Update Report Page

**Files:**
- Modify: `src/components/report/report-summary-table.tsx` — add status column
- Modify: `src/components/report/report-gantt.tsx` — add date labels and status visuals
- Modify: `src/app/timeline/report/page.tsx` — pass statuses

**Step 1: Pass statuses to report components**

Fetch statuses in the report page and pass to both components.

**Step 2: Add status column to summary table**

Add a "Status" column showing colored badge (dot + label).

**Step 3: Add date labels to report gantt bars**

Same logic as Task 5 — show "dd MMM" at bar edges when width > 120px.

**Step 4: Add status visual hints to report gantt**

Same opacity/border logic as Task 6.

**Step 5: Commit**

```bash
git add src/components/report/report-summary-table.tsx src/components/report/report-gantt.tsx src/app/timeline/report/page.tsx
git commit -m "feat(report): add status column and date labels to timeline report"
```

---

## Task 10: Final Verification

**Step 1: Run build**

```bash
npm run build
```

Expected: Clean build with no TypeScript errors.

**Step 2: Manual smoke test**

1. Visit `/admin/timeline/statuses` — CRUD statuses
2. Visit `/timeline` — see date labels on bars, status badges, hover for log icon
3. Edit project — status dropdown works
4. Open progress log panel — add/view logs
5. Visit `/timeline/report` — status column + date labels visible

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix(timeline): address review issues from smoke test"
```
