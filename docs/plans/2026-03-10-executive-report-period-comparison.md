# Executive Report Period Comparison — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add MoM/YoY comparison, status movement, avg achievement delta, and 12-month sparkline to the executive report at `/report/all`.

**Architecture:** Extend existing `getKPIsWithLatestEntry()` to return 12 sparkline entries and batch-fetch previous period entries. Add server-rendered SVG sparkline for print support. Enhance the report page with overview comparison section and per-KPI delta columns.

**Tech Stack:** Next.js server components, Drizzle ORM, SVG sparkline (no client JS), existing `kpi-status.ts` utilities.

---

### Task 1: Extend sparkline entries from 6 to 12

**Files:**
- Modify: `src/lib/queries.ts:86-92`

**Step 1: Update sparkline limit**

In `getKPIsWithLatestEntry()`, change the sparkline limit from 6 to 12:

```typescript
// Line 90: change 6 to 12
if (arr.length < 12) arr.push(entry);
```

**Step 2: Verify no callers break**

Run: `grep -r "sparklineEntries" src/ --include="*.tsx" --include="*.ts"`

Existing callers (kpi-card, page.tsx) use sparklineEntries as-is with `<Sparkline entries={...} />` — more entries is fine, the chart auto-scales.

**Step 3: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat(report): extend sparkline entries from 6 to 12 months"
```

---

### Task 2: Add batch period comparison query

**Files:**
- Modify: `src/lib/queries.ts` (add new function after `getPeriodComparisonEntries`)

**Step 1: Add `getBatchPeriodComparison` function**

Add after line 167 in `src/lib/queries.ts`:

```typescript
/**
 * Batch-fetch previous month and previous year entries for multiple KPIs.
 * Returns a Map<kpiId, { prevMonth, prevYear }>.
 */
export async function getBatchPeriodComparison(
  kpiIds: number[],
  currentPeriodDate: string
): Promise<Map<number, { prevMonth: KPIEntry | null; prevYear: KPIEntry | null }>> {
  if (kpiIds.length === 0) return new Map();

  const [y, m] = currentPeriodDate.split("-").map(Number);
  const prevMonthD = new Date(y, m - 2, 1);
  const prevMonthDate = `${prevMonthD.getFullYear()}-${String(prevMonthD.getMonth() + 1).padStart(2, "0")}-01`;
  const prevYearDate = `${y - 1}-${String(m).padStart(2, "0")}-01`;

  // Fetch all entries up to prevMonth and prevYear dates in two batch queries
  const [prevMonthEntries, prevYearEntries] = await Promise.all([
    db
      .select()
      .from(kpiEntries)
      .where(and(inArray(kpiEntries.kpiId, kpiIds), eq(kpiEntries.periodDate, prevMonthDate))),
    db
      .select()
      .from(kpiEntries)
      .where(and(inArray(kpiEntries.kpiId, kpiIds), eq(kpiEntries.periodDate, prevYearDate))),
  ]);

  const prevMonthMap = new Map<number, KPIEntry>();
  for (const e of prevMonthEntries) prevMonthMap.set(e.kpiId, e);

  const prevYearMap = new Map<number, KPIEntry>();
  for (const e of prevYearEntries) prevYearMap.set(e.kpiId, e);

  const result = new Map<number, { prevMonth: KPIEntry | null; prevYear: KPIEntry | null }>();
  for (const id of kpiIds) {
    result.set(id, {
      prevMonth: prevMonthMap.get(id) ?? null,
      prevYear: prevYearMap.get(id) ?? null,
    });
  }
  return result;
}
```

**Step 2: Commit**

```bash
git add src/lib/queries.ts
git commit -m "feat(report): add batch period comparison query for MoM/YoY"
```

---

### Task 3: Create server-rendered SVG sparkline component

**Files:**
- Create: `src/components/report/report-sparkline.tsx`

**Step 1: Create the SVG sparkline**

This is a server component (no "use client") that renders a pure SVG — works in print.

```typescript
import type { KPIEntry } from "@/lib/db/schema";
import type { KPIStatus } from "@/lib/kpi-status";

interface ReportSparklineProps {
  entries: KPIEntry[];
  status: KPIStatus;
  width?: number;
  height?: number;
}

const statusColor: Record<KPIStatus, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  "no-data": "#94a3b8",
};

export function ReportSparkline({ entries, status, width = 80, height = 24 }: ReportSparklineProps) {
  if (entries.length < 2) return <span className="text-gray-300 text-xs">—</span>;

  const values = entries.map((e) => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * (width - padding * 2) + padding;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const color = statusColor[status];

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/report/report-sparkline.tsx
git commit -m "feat(report): add server-rendered SVG sparkline for print support"
```

---

### Task 4: Create report delta component (print-friendly)

**Files:**
- Create: `src/components/report/report-delta.tsx`

**Step 1: Create the delta display component**

Uses Unicode arrows instead of lucide icons for print compatibility:

```typescript
import { formatValue } from "@/lib/period";
import type { KPIEntry } from "@/lib/db/schema";

interface ReportDeltaProps {
  currentValue: number | null;
  compareEntry: KPIEntry | null;
  unit: string;
  lowerBetter?: boolean;
}

export function ReportDelta({ currentValue, compareEntry, unit, lowerBetter }: ReportDeltaProps) {
  if (currentValue === null || !compareEntry) {
    return <span className="text-gray-300">—</span>;
  }

  const diff = currentValue - compareEntry.value;
  const pct = compareEntry.value !== 0 ? ((diff / compareEntry.value) * 100).toFixed(1) : null;
  const isUp = diff > 0;
  const isFlat = diff === 0;

  const arrow = isFlat ? "—" : isUp ? "\u2191" : "\u2193";
  const isGood = isFlat ? false : lowerBetter ? !isUp : isUp;
  const color = isFlat ? "text-gray-400" : isGood ? "text-green-600" : "text-red-600";

  return (
    <span className={`whitespace-nowrap ${color}`}>
      {arrow} {diff > 0 ? "+" : ""}{formatValue(diff, unit)}
      {pct !== null && <span className="text-gray-400 ml-0.5">({diff > 0 ? "+" : ""}{pct}%)</span>}
    </span>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/report/report-delta.tsx
git commit -m "feat(report): add print-friendly delta component with Unicode arrows"
```

---

### Task 5: Add overview comparison section to executive report

**Files:**
- Modify: `src/app/report/all/page.tsx`

**Step 1: Import new dependencies**

Add to imports at top of file:

```typescript
import { getBatchPeriodComparison } from "@/lib/queries";
```

**Step 2: Fetch previous period data**

After line 21 (`const allKPIsWithEntries = ...`), add:

```typescript
  const kpiIds = allKPIsWithEntries.map(({ kpi }) => kpi.id);
  const comparisonMap = selectedPeriod
    ? await getBatchPeriodComparison(kpiIds, selectedPeriod)
    : new Map();
```

**Step 3: Calculate previous period health score and status movement**

After `healthPct` calculation (line 35), add:

```typescript
  // Previous period health score & status movement
  let prevGreen = 0, prevTotal = 0;
  let improved = 0, declined = 0, stable = 0;
  let totalAchievement = 0, totalAchievementCount = 0;
  let prevTotalAchievement = 0, prevAchievementCount = 0;

  for (const { kpi, latestEntry, effectiveTarget } of allKPIsWithEntries) {
    const currentStatus = getKPIStatus(latestEntry?.value, { ...kpi, ...effectiveTarget });
    const comparison = comparisonMap.get(kpi.id);
    const prevEntry = comparison?.prevMonth ?? null;

    // Achievement tracking
    const ach = getAchievementPct(latestEntry?.value, effectiveTarget.target, kpi.direction);
    if (ach !== null) { totalAchievement += ach; totalAchievementCount++; }

    if (prevEntry) {
      prevTotal++;
      const prevStatus = getKPIStatus(prevEntry.value, { ...kpi, ...effectiveTarget });
      if (prevStatus === "green") prevGreen++;

      const prevAch = getAchievementPct(prevEntry.value, effectiveTarget.target, kpi.direction);
      if (prevAch !== null) { prevTotalAchievement += prevAch; prevAchievementCount++; }

      const statusOrder = { "green": 3, "yellow": 2, "red": 1, "no-data": 0 };
      const diff = statusOrder[currentStatus] - statusOrder[prevStatus];
      if (diff > 0) improved++;
      else if (diff < 0) declined++;
      else stable++;
    }
  }

  const prevHealthPct = prevTotal > 0 ? Math.round((prevGreen / prevTotal) * 100) : null;
  const healthDelta = prevHealthPct !== null ? healthPct - prevHealthPct : null;
  const avgAchievement = totalAchievementCount > 0 ? Math.round(totalAchievement / totalAchievementCount) : null;
  const prevAvgAchievement = prevAchievementCount > 0 ? Math.round(prevTotalAchievement / prevAchievementCount) : null;
  const achievementDelta = avgAchievement !== null && prevAvgAchievement !== null ? avgAchievement - prevAvgAchievement : null;
```

**Step 4: Add comparison cards to header**

After the health score bar (after line 75, before `</header>`), insert:

```tsx
        {/* Period comparison overview */}
        {(healthDelta !== null || improved > 0 || declined > 0) && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs">
            {healthDelta !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Health Score:</span>
                <span className={healthDelta > 0 ? "text-green-600 font-semibold" : healthDelta < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                  {healthDelta > 0 ? "\u2191" : healthDelta < 0 ? "\u2193" : "—"} {healthDelta > 0 ? "+" : ""}{healthDelta}pp vs prev
                </span>
              </div>
            )}
            {prevTotal > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Movement:</span>
                {improved > 0 && <span className="text-green-600 font-semibold">{improved} improved</span>}
                {declined > 0 && <span className="text-red-600 font-semibold">{declined} declined</span>}
                {stable > 0 && <span className="text-gray-500">{stable} stable</span>}
              </div>
            )}
            {achievementDelta !== null && (
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500">Avg Achievement:</span>
                <span className={achievementDelta > 0 ? "text-green-600 font-semibold" : achievementDelta < 0 ? "text-red-600 font-semibold" : "text-gray-500"}>
                  {avgAchievement}% ({achievementDelta > 0 ? "+" : ""}{achievementDelta}pp)
                </span>
              </div>
            )}
          </div>
        )}
```

**Step 5: Commit**

```bash
git add src/app/report/all/page.tsx
git commit -m "feat(report): add overview period comparison with health delta and status movement"
```

---

### Task 6: Add MoM, YoY, and sparkline columns to per-KPI table

**Files:**
- Modify: `src/app/report/all/page.tsx`

**Step 1: Import new components**

Add to imports:

```typescript
import { ReportSparkline } from "@/components/report/report-sparkline";
import { ReportDelta } from "@/components/report/report-delta";
```

**Step 2: Add column headers**

In the `<thead>` row (lines 97-103), add 3 new columns after the Status column:

```tsx
                  <th className="text-center py-1.5 px-2 font-medium">MoM</th>
                  <th className="text-center py-1.5 px-2 font-medium">YoY</th>
                  <th className="text-center py-1.5 pl-2 font-medium">Trend</th>
```

**Step 3: Add data cells to each KPI row**

Inside the `kpis.map(...)` callback (after the Status `<td>`, before `</tr>`), add:

```tsx
                      <td className="py-1.5 px-2 text-center">
                        <ReportDelta
                          currentValue={latestEntry?.value ?? null}
                          compareEntry={comparisonMap.get(kpi.id)?.prevMonth ?? null}
                          unit={kpi.unit}
                          lowerBetter={kpi.direction === "lower_better"}
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <ReportDelta
                          currentValue={latestEntry?.value ?? null}
                          compareEntry={comparisonMap.get(kpi.id)?.prevYear ?? null}
                          unit={kpi.unit}
                          lowerBetter={kpi.direction === "lower_better"}
                        />
                      </td>
                      <td className="py-1.5 pl-2 text-center">
                        <ReportSparkline entries={sparklineEntries} status={status} />
                      </td>
```

Note: `sparklineEntries` needs to be destructured — update the `.map()` callback parameter from:
```typescript
{kpis.map(({ kpi, latestEntry, effectiveTarget }) => {
```
to:
```typescript
{kpis.map(({ kpi, latestEntry, effectiveTarget, sparklineEntries }) => {
```

**Step 4: Commit**

```bash
git add src/app/report/all/page.tsx
git commit -m "feat(report): add MoM, YoY delta and sparkline columns to KPI table"
```

---

### Task 7: Verify build and visual check

**Step 1: Run build**

```bash
npm run build
```

Expected: No type errors, no build failures.

**Step 2: Run dev server and check visually**

```bash
npm run dev
```

Navigate to `/report/all`. Verify:
- Overview section shows health delta, status movement, avg achievement delta
- Each KPI row has MoM, YoY, and sparkline columns
- Sparkline shows 12-month trend
- Delta arrows use correct colors (green = good, red = bad)

**Step 3: Test print**

Click Print button. Verify:
- SVG sparklines render in print
- Unicode arrows appear correctly
- Layout doesn't overflow

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(report): address visual issues from period comparison review"
```
