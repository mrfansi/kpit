import assert from "node:assert/strict";
import test from "node:test";
import { brandStyleSchema, contrastProblems, DEFAULT_BRAND_STYLE } from "./brand";
import { presentationBrandSample } from "./brand-preview";

test("brand schema rejects unsafe colors, unknown fonts and status color overrides", () => {
  assert.equal(brandStyleSchema.safeParse(DEFAULT_BRAND_STYLE).success, true);
  assert.equal(brandStyleSchema.safeParse({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, primary: "#fff" } }).success, false);
  assert.equal(brandStyleSchema.safeParse({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, primary: "red;}</style><script>alert(1)</script>" } }).success, false);
  assert.equal(brandStyleSchema.safeParse({ ...DEFAULT_BRAND_STYLE, fonts: { ...DEFAULT_BRAND_STYLE.fonts, heading: "Unknown Font" } }).success, false);
  assert.equal(brandStyleSchema.safeParse({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, red: "#000000" } }).success, false);
});

test("contrast guard accepts default and identifies unreadable text/background pairs", () => {
  assert.deepEqual(contrastProblems(DEFAULT_BRAND_STYLE), []);
  const problems = contrastProblems({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, background: "#ffff00", surface: "#ffff00", text: "#ffffff" } });
  assert.ok(problems.some((problem) => problem.includes("Teks pada latar awal")));
  assert.ok(problems.some((problem) => problem.includes("Teks pada permukaan")));
});

test("muted body text needs 4.5:1 while primary (non-text UI) needs only 3:1", () => {
  // #64748b on #0f172a is ~3.7:1: readable for large UI accents, not for 12–16px text.
  const midContrast = "#64748b";
  const muted = contrastProblems({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, mutedText: midContrast } });
  assert.ok(muted.some((problem) => problem.startsWith("Teks sekunder pada latar awal") && problem.includes("minimal 4.5:1")), muted.join("; "));
  const primary = contrastProblems({ ...DEFAULT_BRAND_STYLE, colors: { ...DEFAULT_BRAND_STYLE.colors, primary: midContrast } });
  assert.deepEqual(primary, []);
});

test("preview sample uses the real report computation and includes a missed target", () => {
  const sample = presentationBrandSample();
  assert.equal(sample.ready, true, sample.questions.map((q) => q.question).join("; "));
  assert.equal(sample.metrics.length, 4);
  assert.ok(sample.metrics.some((metric) => metric.missedTarget));
  assert.ok(sample.content.risks.length && sample.content.actions.length);
  assert.match(sample.content.summary.join(" "), /DATA CONTOH/);
});
