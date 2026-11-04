import assert from "node:assert/strict";
import test from "node:test";
import { DeepSeekProvider } from "../ai/deepseek-provider";
import { AIServiceError } from "../ai/types";
import { DEFAULT_BRAND_STYLE } from "./brand";
import { BrandGenerationError, generatePresentationBrand } from "./brand-generate";

async function withResponses(contents: string[], run: (bodies: Record<string, unknown>[]) => Promise<void>) {
  const original = globalThis.fetch;
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_url, init) => {
    bodies.push(JSON.parse(init!.body as string));
    const content = contents[bodies.length - 1];
    assert.notEqual(content, undefined, "No more than two provider requests");
    return Response.json({ choices: [{ finish_reason: "stop", message: { content } }] });
  }) as typeof fetch;
  try {
    await run(bodies);
  } finally {
    globalThis.fetch = original;
  }
}

const ai = () => new DeepSeekProvider("test-brand-key");
const valid = JSON.stringify(DEFAULT_BRAND_STYLE);
const promptAt = (body: Record<string, unknown>) => (body.messages as { content: string }[])[0].content;

test("valid token JSON produces the success payload and requests JSON response format", async () => {
  await withResponses([`\`\`\`json\n${valid}\n\`\`\``], async (bodies) => {
    const result = await generatePresentationBrand(ai(), { instruction: "Navy profesional" });
    assert.deepEqual(result.style, DEFAULT_BRAND_STYLE);
    assert.match(result.summary, /latar gelap/);
    assert.match(result.summary, /Inter/);
    assert.match(result.summary, /#3b82f6/);
    assert.equal(bodies.length, 1);
    assert.deepEqual(bodies[0].response_format, { type: "json_object" });
  });
});

test("schema failure is repaired exactly once", async () => {
  await withResponses([JSON.stringify({ ...DEFAULT_BRAND_STYLE, fonts: { heading: "Unknown", body: "Inter" } }), valid], async (bodies) => {
    const result = await generatePresentationBrand(ai(), { instruction: "Profesional" });
    assert.deepEqual(result.style, DEFAULT_BRAND_STYLE);
    assert.equal(bodies.length, 2);
    assert.match(promptAt(bodies[1]), /fonts.heading/);
    assert.deepEqual(bodies[1].response_format, { type: "json_object" });
  });
});

test("contrast failures name the failing pairs in the single repair request", async () => {
  const bad = { ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, text: DEFAULT_BRAND_STYLE.colors.background } };
  await withResponses([JSON.stringify(bad), valid], async (bodies) => {
    assert.deepEqual((await generatePresentationBrand(ai(), { instruction: "Buat mudah dibaca" })).style, DEFAULT_BRAND_STYLE);
    assert.match(promptAt(bodies[1]), /Teks pada latar awal: kontras 1.00:1/);
  });
});

test("unreadable output twice becomes a named Indonesian 422 failure", async () => {
  await withResponses(["not json", "still not json"], async (bodies) => {
    await assert.rejects(generatePresentationBrand(ai(), { instruction: "Profesional" }), (error: unknown) => {
      assert.ok(error instanceof BrandGenerationError);
      assert.equal(error.status, 422);
      assert.match(error.message, /Gaya presentasi belum dapat dibuat/);
      assert.match(error.message, /JSON yang dapat dibaca/);
      return true;
    });
    assert.equal(bodies.length, 2);
  });
});

test("persistent contrast failures become 422 with readable pair names", async () => {
  const bad = JSON.stringify({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, mutedText: DEFAULT_BRAND_STYLE.colors.surface } });
  await withResponses([bad, bad], async () => {
    await assert.rejects(generatePresentationBrand(ai(), { instruction: "Minimalis" }), (error: unknown) => {
      assert.ok(error instanceof BrandGenerationError);
      assert.equal(error.status, 422);
      assert.match(error.message, /Teks sekunder pada permukaan/);
      return true;
    });
  });
});

test("refinement passes the full base and preservation rules through the prompt", async () => {
  const base = { ...DEFAULT_BRAND_STYLE, name: "Identitas kantor", footerText: "Internal", guideline: "Pertahankan jarak" };
  await withResponses([JSON.stringify(base)], async (bodies) => {
    const result = await generatePresentationBrand(ai(), { instruction: "Pertahankan semua warna" , base });
    assert.deepEqual(result.style, base);
    const prompt = promptAt(bodies[0]);
    assert.ok(prompt.includes(JSON.stringify(base)));
    assert.match(prompt, /pertahankan semua field gaya dasar yang tidak terkait instruksi/);
    assert.match(prompt, /Jangan mengarang atau mengubah warna status KPI/);
  });
});

test("provider outages and absent API keys are not retried or converted into validation failures", async () => {
  for (const code of ["provider_error", "no_api_key"] as const) {
    let calls = 0;
    const error = new AIServiceError("Layanan tidak tersedia", code);
    await assert.rejects(generatePresentationBrand({ generateText: async () => { calls++; throw error; } }, { instruction: "Profesional" }), (caught: unknown) => caught === error);
    assert.equal(calls, 1);
  }
});
