/** Test stand-in for `cloudflare:workers`; `installTestEnv` is called by createTestD1(). */
const slot = Symbol.for("kpit.test-cloudflare-env");
const holder = globalThis as unknown as Record<symbol, Record<string, unknown> | undefined>;

export function installTestEnv(value: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const previous = holder[slot];
  if (value === undefined) delete holder[slot];
  else holder[slot] = value;
  return previous;
}

export const env = new Proxy({} as Record<string, unknown>, {
  get(_target, key) {
    const current = holder[slot];
    if (!current) throw new Error("No Cloudflare env: call createTestD1() first.");
    return current[key as string];
  },
});
