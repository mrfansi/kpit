import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const dir = join(process.cwd(), "src/lib/actions");
const comments = /\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm;

// Every exported server action is a public POST endpoint, so each must authorize itself.
test("every exported server action calls requireAdmin or requireAuth", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  let checked = 0;

  for (const file of files) {
    const src = readFileSync(join(dir, file), "utf8").replace(comments, "");
    if (!/^\s*["']use server["']/.test(src)) continue;

    // Each action runs from its declaration to the next top-level export (or EOF).
    const chunks = src.split(/^(?=export\s)/m).filter((c) => /^export\s+async\s+function\s/.test(c));
    for (const chunk of chunks) {
      const name = /^export\s+async\s+function\s+(\w+)/.exec(chunk)![1];
      assert.match(chunk, /\brequire(Admin|Auth)\(/, `${file}: ${name} has no auth guard`);
      checked++;
    }
  }

  assert.ok(checked > 0, "no server actions found; the parser is probably broken");
});
