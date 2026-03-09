# Launch Estimation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add launch estimation date per timeline project — auto-calculated from endDate + buffer days, with manual override option, visualized as a vertical marker in the Gantt chart.

**Architecture:** Two new columns on `timeline_projects` (`launchBufferDays` integer default 7, `estimatedLaunchDate` text nullable). A helper function computes the effective launch date: manual override takes priority, otherwise endDate + buffer. A new `GanttLaunchMarker` component renders per-row vertical lines on the Gantt canvas.

**Tech Stack:** Drizzle ORM (SQLite), Zod validation, Next.js server actions, React components, date-fns, Tailwind CSS.

---

### Task 1: Database Schema — Add Launch Columns

**Files:**
- Modify: `src/lib/db/schema.ts:115-130`
- Create: `drizzle/0009_launch_estimation.sql`

**Step 1: Add columns to schema**

In `src/lib/db/schema.ts`, add two columns to the `timelineProjects` table definition, after the `progress` field (line 122):

```typescript
// Add after: progress: integer("progress").notNull().default(0),
launchBufferDays: integer("launch_buffer_days").notNull().default(7),
estimatedLaunchDate: text("estimated_launch_date"),
```

**Step 2: Create SQL migration file**

Create `drizzle/0009_launch_estimation.sql`:

```sql
ALTER TABLE timeline_projects ADD COLUMN launch_buffer_days integer NOT NULL DEFAULT 7;
ALTER TABLE timeline_projects ADD COLUMN estimated_launch_date text;
```

**Step 3: Run migration to verify**

Run: `npx drizzle-kit push`
Expected: Schema applied successfully, no errors.

**Step 4: Commit**

```bash
git add src/lib/db/schema.ts drizzle/0009_launch_estimation.sql
git commit -m "feat: add launch estimation columns to timeline_projects"
```

---

### Task 2: Launch Date Helper Function

**Files:**
- Create: `src/lib/launch-date.ts`

**Step 1: Create the helper**

Create `src/lib/launch-date.ts`:

```typescript
import { addDays, format, parseISO } from "date-fns";

/**
 * Compute the effective launch date for a timeline project.
 * Manual override (estimatedLaunchDate) takes priority.
 * Otherwise, returns endDate + launchBufferDays.
 */
export function getEffectiveLaunchDate(project: {
  endDate: string;
  launchBufferDays: number;
  estimatedLaunchDate: string | null;
}): string {
  if (project.estimatedLaunchDate) {
    return project.estimatedLaunchDate;
  }
  return format(addDays(parseISO(project.endDate), project.launchBufferDays), "yyyy-MM-dd");
}

/**
 * Check if the launch date is a manual override.
 */
export function isManualLaunchDate(project: {
  estimatedLaunchDate: string | null;
}): boolean {
  return project.estimatedLaunchDate !== null;
}
```

**Step 2: Commit**

```bash
git add src/lib/launch-date.ts
git commit -m "feat: add launch date helper function"
```

---

### Task 3: Validation Schema — Add Launch Fields

**Files:**
- Modify: `src/lib/validations/timeline.ts:11-24`

**Step 1: Update projectSchema**

Replace the `projectSchema` in `src/lib/validations/timeline.ts`:

```typescript
export const projectSchema = z
  .object({
    name: z.string().min(2, "Nama minimal 2 karakter").max(100),
    color: hexColor.default("#6366f1"),
    description: z.string().max(500).optional().or(z.literal("")),
    startDate: isoDate,
    endDate: isoDate,
    progress: z.coerce.number().int().min(0).max(100).default(0),
    sortOrder: z.coerce.number().int().default(0),
    launchBufferDays: z.coerce.number().int().min(0).max(365).default(7),
    estimatedLaunchDate: isoDate.optional().or(z.literal("")),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai harus setelah atau sama dengan tanggal mulai",
    path: ["endDate"],
  })
  .refine(
    (data) => {
      if (!data.estimatedLaunchDate) return true;
      return data.estimatedLaunchDate >= data.endDate;
    },
    {
      message: "Tanggal launching harus setelah atau sama dengan tanggal selesai",
      path: ["estimatedLaunchDate"],
    }
  );
```

**Step 2: Commit**

```bash
git add src/lib/validations/timeline.ts
git commit -m "feat: add launch estimation fields to validation schema"
```

---

### Task 4: Server Actions — Handle Launch Fields

**Files:**
- Modify: `src/lib/actions/timeline.ts:16-36` (createProject)
- Modify: `src/lib/actions/timeline.ts:38-58` (updateProject)

**Step 1: Update createProject action**

In `createProject`, change the `db.insert` call to handle the new fields. Replace lines 23-27:

```typescript
  const launchDate = parsed.data.estimatedLaunchDate || null;

  await db.insert(timelineProjects).values({
    name: parsed.data.name,
    color: parsed.data.color,
    description: parsed.data.description,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    progress: parsed.data.progress,
    sortOrder: parsed.data.sortOrder,
    launchBufferDays: parsed.data.launchBufferDays,
    estimatedLaunchDate: launchDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
```

**Step 2: Update updateProject action**

In `updateProject`, change the `db.update` call. Replace lines 45-48:

```typescript
  const launchDate = parsed.data.estimatedLaunchDate || null;

  await db
    .update(timelineProjects)
    .set({
      name: parsed.data.name,
      color: parsed.data.color,
      description: parsed.data.description,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      progress: parsed.data.progress,
      sortOrder: parsed.data.sortOrder,
      launchBufferDays: parsed.data.launchBufferDays,
      estimatedLaunchDate: launchDate,
      updatedAt: new Date(),
    })
    .where(eq(timelineProjects.id, id));
```

**Step 3: Commit**

```bash
git add src/lib/actions/timeline.ts
git commit -m "feat: handle launch estimation fields in server actions"
```

---

### Task 5: Gantt Launch Marker Component

**Files:**
- Create: `src/components/gantt/gantt-launch-marker.tsx`

**Step 1: Create the marker component**

Create `src/components/gantt/gantt-launch-marker.tsx`:

```tsx
"use client";

import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface GanttLaunchMarkerProps {
  x: number;
  y: number;
  height: number;
  launchDate: string;
  isManualOverride: boolean;
}

export function GanttLaunchMarker({
  x,
  y,
  height,
  launchDate,
  isManualOverride,
}: GanttLaunchMarkerProps) {
  if (x < 0) return null;

  const label = format(parseISO(launchDate), "dd MMM", { locale: idLocale });

  return (
    <div
      className="absolute z-15 pointer-events-none"
      style={{ left: x, top: y, height }}
    >
      {/* Vertical dashed line */}
      <div
        className="absolute top-0 w-0.5 h-full"
        style={{
          background: "repeating-linear-gradient(to bottom, #10b981 0px, #10b981 4px, transparent 4px, transparent 8px)",
        }}
      />
      {/* Label badge */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-0.5">
        <span>🚀</span>
        <span>{label}</span>
        {isManualOverride && (
          <span className="opacity-70" title="Manual override">✏️</span>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/gantt/gantt-launch-marker.tsx
git commit -m "feat: add GanttLaunchMarker component"
```

---

### Task 6: Integrate Launch Marker into Gantt Chart

**Files:**
- Modify: `src/components/gantt/gantt-chart.tsx`

**Step 1: Add imports**

At the top of `gantt-chart.tsx`, add these imports after existing ones:

```typescript
import { GanttLaunchMarker } from "./gantt-launch-marker";
import { getEffectiveLaunchDate, isManualLaunchDate } from "@/lib/launch-date";
```

**Step 2: Extend layout maxDate calculation**

In the `layout` useMemo (around line 73-77), extend `maxDate` to account for launch dates:

```typescript
    if (localProjects.length > 0) {
      const starts = localProjects.map((p) => parseISO(p.startDate));
      const ends = localProjects.map((p) => parseISO(p.endDate));
      const launches = localProjects.map((p) =>
        parseISO(getEffectiveLaunchDate(p))
      );
      minDate = new Date(Math.min(...starts.map((d) => d.getTime())));
      maxDate = new Date(
        Math.max(
          ...ends.map((d) => d.getTime()),
          ...launches.map((d) => d.getTime())
        )
      );
    } else {
      minDate = new Date();
      maxDate = addMonths(new Date(), 6);
    }
```

**Step 3: Render launch markers per project row**

Inside the `{/* Project bars */}` section (after the project bar `</div>` closing tag, around line 412), add the launch marker rendering inside the same `.map()`. Add this right after the closing `</div>` of each project bar (inside the map callback, before the `return` closes):

Actually, render the markers as a separate loop right after the project bars loop (after line 414, before the closing `</div>` of the relative container):

```tsx
              {/* Launch markers */}
              {localProjects.map((project, rowIndex) => {
                const launchDate = getEffectiveLaunchDate(project);
                const launchX = layout.dateToX(launchDate);
                const y = rowIndex * ROW_HEIGHT + 8;
                const markerHeight = ROW_HEIGHT - 16;

                return (
                  <GanttLaunchMarker
                    key={`launch-${project.id}`}
                    x={launchX}
                    y={y}
                    height={markerHeight}
                    launchDate={launchDate}
                    isManualOverride={isManualLaunchDate(project)}
                  />
                );
              })}
```

**Step 4: Commit**

```bash
git add src/components/gantt/gantt-chart.tsx
git commit -m "feat: integrate launch markers into Gantt chart"
```

---

### Task 7: Project Form — Launch Estimation Section

**Files:**
- Modify: `src/components/timeline-project-form.tsx`

**Step 1: Add imports and state**

Add to imports:

```typescript
import { getEffectiveLaunchDate } from "@/lib/launch-date";
import { Rocket } from "lucide-react";
```

Inside the component, add state for manual override toggle. After `const [selectedColor, setSelectedColor] = ...` (around line 52):

```typescript
  const [manualLaunch, setManualLaunch] = useState(!!project?.estimatedLaunchDate);
```

Sync it when project changes — add to the existing useEffect that syncs color, or add a new one:

```typescript
  useEffect(() => {
    setManualLaunch(!!project?.estimatedLaunchDate);
  }, [project?.id]);
```

**Step 2: Add launch estimation section to the form**

After the description `<div>` section (after line 187, before the `<div className="flex justify-between">` buttons section), add:

```tsx
            {/* Launch Estimation Section */}
            <div className="space-y-2 rounded-lg border p-3 bg-muted/30">
              <div className="flex items-center gap-2 mb-2">
                <Rocket className="w-3.5 h-3.5 text-emerald-600" />
                <Label className="text-sm font-medium">Estimasi Launching</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="launchBufferDays" className="text-xs text-muted-foreground">
                    Buffer (hari setelah selesai)
                  </Label>
                  <Input
                    id="launchBufferDays"
                    name="launchBufferDays"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={project?.launchBufferDays ?? 7}
                    disabled={manualLaunch}
                    className={manualLaunch ? "opacity-50" : ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Tanggal Launch
                  </Label>
                  {manualLaunch ? (
                    <Input
                      name="estimatedLaunchDate"
                      type="date"
                      defaultValue={project?.estimatedLaunchDate ?? ""}
                    />
                  ) : (
                    <>
                      <input type="hidden" name="estimatedLaunchDate" value="" />
                      <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                        {project
                          ? getEffectiveLaunchDate({
                              endDate: project.endDate,
                              launchBufferDays: project.launchBufferDays ?? 7,
                              estimatedLaunchDate: null,
                            })
                          : "Auto dari tanggal selesai + buffer"}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={manualLaunch}
                  onChange={(e) => setManualLaunch(e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-xs text-muted-foreground">Override manual</span>
              </label>
            </div>
```

**Step 3: Commit**

```bash
git add src/components/timeline-project-form.tsx
git commit -m "feat: add launch estimation section to project form"
```

---

### Task 8: Left Panel — Show Launch Date Info

**Files:**
- Modify: `src/components/gantt/gantt-chart.tsx` (left panel section)

**Step 1: Update left panel project info**

In the left panel's project list (around line 289-291), replace the date display to include launch info:

```tsx
                  <span className="text-[10px] text-muted-foreground">
                    {project.startDate} — {project.endDate}
                    <span className="text-emerald-600 ml-1">
                      🚀 {getEffectiveLaunchDate(project)}
                    </span>
                  </span>
```

**Step 2: Commit**

```bash
git add src/components/gantt/gantt-chart.tsx
git commit -m "feat: show launch date in Gantt left panel"
```

---

### Task 9: Build Verification

**Step 1: Run build to verify no type errors**

Run: `npx next build`
Expected: Build succeeds with no errors.

**Step 2: Run the app and verify visually**

Run: `npm run dev`

Verify:
- [ ] Existing projects show launch marker (default: endDate + 7 days)
- [ ] Marker is emerald-colored dashed vertical line with label
- [ ] Creating new project includes launch estimation section
- [ ] Editing project shows current buffer/override values
- [ ] Toggle "Override manual" switches between auto and manual mode
- [ ] Drag/resize project bar → auto launch date shifts accordingly
- [ ] Left panel shows launch date for each project

**Step 3: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: launch estimation adjustments from manual testing"
```
