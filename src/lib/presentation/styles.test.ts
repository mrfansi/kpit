import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_BRAND_STYLE, type BrandStyle } from "./brand";
import { getPresentationStyles } from "./styles";
import { buildPresentationPrompt } from "../report-markdown";

const custom: BrandStyle = {
  ...DEFAULT_BRAND_STYLE,
  name: "Studio",
  mode: "light",
  colors: { background: "#ffffff", backgroundEnd: "#eeeeee", surface: "#dddddd", text: "#111111", mutedText: "#444444", primary: "#663399", accent: "#cc5500" },
  fonts: { heading: "Playfair Display", body: "DM Sans" },
  radius: "none",
  titleCase: "uppercase",
  guideline: "Editorial, tenang dan ringkas",
};

test("default retains navy, Inter, translucent cards and fixed status colors", () => {
  const css = getPresentationStyles();
  assert.match(css, /--bg-start: #0f172a/);
  assert.match(css, /--bg-end: #1e293b/);
  assert.match(css, /--card-bg: rgba\(255,255,255,0\.08\)/);
  assert.match(css, /--primary: #3b82f6/);
  assert.match(css, /--accent: #22c55e/);
  assert.equal((css.match(/family=Inter/g) ?? []).length, 1);
});

test("custom tokens style typography, surfaces and decoration without changing statuses", () => {
  const css = getPresentationStyles(custom);
  assert.match(css, /family=Playfair\+Display:wght@400;600;700;900&family=DM\+Sans:wght@400;600;700;900&display=swap/);
  assert.doesNotMatch(css, /family=Inter/);
  for (const color of Object.values(custom.colors)) assert.ok(css.includes(color));
  assert.match(css, /--radius: 0;/);
  assert.match(css, /--title-case: uppercase/);
  assert.match(css, /--font-heading: 'Playfair Display'/);
  assert.match(css, /--font-body: 'DM Sans'/);
  assert.match(css, /--green: #22c55e/);
  assert.match(css, /--yellow: #eab308/);
  assert.match(css, /--red: #ef4444/);
  assert.match(css, /linear-gradient\(90deg, var\(--accent\), var\(--primary\)\)/);
});

test("presentation prompt keeps default unchanged and includes custom visual guidance", () => {
  const report = "# Fakta laporan\nAngka bersumber";
  assert.equal(buildPresentationPrompt(report), buildPresentationPrompt(report, DEFAULT_BRAND_STYLE));
  assert.doesNotMatch(buildPresentationPrompt(report), /GAYA VISUAL \/ BRAND/);
  const prompt = buildPresentationPrompt(report, custom);
  for (const value of [custom.name, custom.mode, ...Object.values(custom.colors), ...Object.values(custom.fonts), custom.guideline]) assert.ok(prompt.includes(value));
  assert.match(prompt, /GAYA VISUAL \/ BRAND/);
  assert.ok(prompt.endsWith(report));
});
