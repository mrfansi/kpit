# AI Generate Deskripsi KPI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Generate Deskripsi" button to the KPI form that uses Gemini to auto-generate a description based on KPI context (name, unit, target, direction, domain).

**Architecture:** API route receives KPI context, constructs a prompt, calls Gemini 3.1 Flash Lite, returns description string. The existing KPI form (already a client component) adds a button next to the description field that fetches the API and fills the field.

**Tech Stack:** @google/generative-ai (already installed), Next.js API routes, react-hook-form (already in use)

---

### Task 1: Create API route for description generation

**Files:**
- Create: `src/app/api/kpi/generate-description/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@/auth";

interface DescriptionRequest {
  name: string;
  unit: string;
  target: number;
  direction: string;
  domain: string;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI tidak tersedia. GOOGLE_AI_API_KEY belum dikonfigurasi." },
      { status: 503 }
    );
  }

  const body: DescriptionRequest = await request.json();

  if (!body.name || body.name.trim().length < 3) {
    return NextResponse.json(
      { error: "Nama KPI minimal 3 karakter." },
      { status: 400 }
    );
  }

  const directionText = body.direction === "lower_better"
    ? "semakin rendah semakin baik"
    : "semakin tinggi semakin baik";

  const prompt = `Tulis 1 kalimat deskripsi singkat dalam Bahasa Indonesia untuk KPI berikut:

- Nama KPI: ${body.name}
- Domain: ${body.domain}
- Unit: ${body.unit}
- Target: ${body.target} ${body.unit}
- Arah: ${directionText}

Instruksi:
- Maksimal 200 karakter
- Jelaskan apa yang diukur dan mengapa penting bagi bisnis
- Langsung tulis deskripsinya, tanpa awalan seperti "Deskripsi:" atau "KPI ini..."
- Jangan gunakan markdown formatting
- Satu kalimat saja, padat dan informatif`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Strip markdown if any
    text = text.replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1");

    // Remove prefix patterns
    text = text.replace(/^(Deskripsi|KPI ini|Mengukur)\s*:\s*/i, "");

    // Enforce max length
    if (text.length > 255) {
      text = text.substring(0, 252) + "...";
    }

    return NextResponse.json({ description: text });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Gagal menghasilkan deskripsi. Silakan coba lagi." },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/kpi/generate-description/route.ts
git commit -m "feat(kpi): add API route for AI description generation via Gemini"
```

---

### Task 2: Add generate button to KPI form

**Files:**
- Modify: `src/components/kpi-form.tsx`

**Step 1: Add state and handler for AI generation**

After the `const form = useForm(...)` block (after line 54), add:

```typescript
const [generating, setGenerating] = useState(false);

async function handleGenerateDescription() {
  const name = form.getValues("name");
  if (!name || name.trim().length < 3) {
    toast.error("Isi nama KPI terlebih dahulu (minimal 3 karakter)");
    return;
  }

  const domainId = form.getValues("domainId");
  const domain = domains.find((d) => d.id === domainId);

  setGenerating(true);
  try {
    const res = await fetch("/api/kpi/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        unit: form.getValues("unit") || "%",
        target: form.getValues("target") || 0,
        direction: form.getValues("direction") || "higher_better",
        domain: domain?.name || "Umum",
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Gagal menghasilkan deskripsi");
    }

    const data = await res.json();
    form.setValue("description", data.description, { shouldDirty: true });
    toast.success("Deskripsi berhasil di-generate");
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Terjadi kesalahan");
  } finally {
    setGenerating(false);
  }
}
```

**Step 2: Add `useState` import**

Update line 1 imports — add `useState`:

```typescript
import { useState } from "react";
```

**Step 3: Replace the description FormField (lines 108-119)**

Replace the existing description field with:

```tsx
{/* Deskripsi */}
<FormField
  control={form.control}
  name="description"
  render={({ field }) => (
    <FormItem>
      <div className="flex items-center justify-between">
        <FormLabel>Deskripsi <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
        <button
          type="button"
          onClick={handleGenerateDescription}
          disabled={generating}
          className="text-xs px-2 py-0.5 rounded border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {generating ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              Generating...
            </>
          ) : (
            "Generate"
          )}
        </button>
      </div>
      <FormControl><Input placeholder="Penjelasan singkat KPI ini..." {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

**Step 5: Commit**

```bash
git add src/components/kpi-form.tsx
git commit -m "feat(kpi): add AI generate description button to KPI form"
```

---

### Task 3: Manual testing and fixes

**Step 1: Run the dev server**

```bash
npm run dev
```

**Step 2: Navigate to `/admin/kpi/new`**

Verify:
- "Generate" button appears next to "Deskripsi" label
- Button is clickable after filling nama KPI
- Loading spinner shows during generation
- Description field fills with AI-generated text
- User can edit the generated description
- Error shows toast if nama KPI is empty
- Error shows toast if API key is missing (503)

**Step 3: Test edit mode at `/admin/kpi/[id]/edit`**

Verify:
- Existing description shows in field
- Generate button overwrites existing description
- Form submits correctly with generated description

**Step 4: Fix any issues found, commit if needed**

```bash
git add -A
git commit -m "fix(kpi): address issues from AI description generator review"
```
