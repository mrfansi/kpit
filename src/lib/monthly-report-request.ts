export type MonthlyMutationRejection = { status: 403 | 415; error: string };

/** Host is the browser's destination; forwarded-host is intentionally never trusted. */
export function checkMonthlyMutationRequest(request: Request, configuredAuthUrl = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL): MonthlyMutationRejection | null {
  const origin = request.headers.get("origin");
  let expected: string;
  try {
    if (configuredAuthUrl) {
      const configured = new URL(configuredAuthUrl);
      if (!["http:", "https:"].includes(configured.protocol)) throw new Error("Invalid public origin");
      expected = configured.origin;
    } else {
      const host = request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.slice(0, -1);
      if (!host || /[\s,@\\\/]/.test(host) || !["http", "https"].includes(proto)) throw new Error("Invalid destination");
      const destination = new URL(`${proto}://${host}`);
      if (destination.host !== host.toLowerCase() || destination.pathname !== "/") throw new Error("Invalid destination");
      expected = destination.origin;
    }
    if (!origin || origin === "null" || new URL(origin).origin !== origin || origin !== expected)
      return { status: 403, error: "Cross-origin report mutation forbidden" };
  } catch {
    return { status: 403, error: "Cross-origin report mutation forbidden" };
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json")
    return { status: 415, error: "Content-Type must be application/json" };
  return null;
}
