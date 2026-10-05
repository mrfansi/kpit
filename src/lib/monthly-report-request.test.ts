import assert from "node:assert/strict";
import test from "node:test";
import { checkMonthlyMutationRequest } from "./monthly-report-request";

function mutation(origin: string | null, contentType: string | null, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/report/monthly/ai", {
    method: "POST",
    headers: { host: "reports.example.com", "x-forwarded-proto": "https", ...(origin === null ? {} : { origin }), ...(contentType === null ? {} : { "content-type": contentType }), ...headers },
  });
}

test("mutation policy accepts public HTTPS browser origin behind internal listener without trusting forwarded host", () => {
  assert.equal(checkMonthlyMutationRequest(mutation("https://reports.example.com", "application/json; charset=utf-8"), ""), null);
  assert.deepEqual(checkMonthlyMutationRequest(mutation("https://evil.example.com", "application/json"), ""), { status: 403, error: "Cross-origin report mutation forbidden" });
  assert.equal(checkMonthlyMutationRequest(mutation("https://evil.example.com", "application/json", { "x-forwarded-host": "evil.example.com" }), "")?.status, 403);
  assert.equal(checkMonthlyMutationRequest(mutation("null", "application/json"), "")?.status, 403);
  assert.equal(checkMonthlyMutationRequest(mutation(null, "application/json"), "")?.status, 403);
  assert.equal(checkMonthlyMutationRequest(mutation("https://reports.example.com/", "application/json"), "")?.status, 403);
  assert.equal(checkMonthlyMutationRequest(mutation("https://reports.example.com", "text/plain"), "")?.status, 415);
  assert.equal(checkMonthlyMutationRequest(mutation("https://reports.example.com", null), "")?.status, 415);
  assert.equal(checkMonthlyMutationRequest(mutation("http://localhost:3000", "application/json", { host: "localhost:3000", "x-forwarded-proto": "http" }), ""), null);
});
test("configured public auth URL pins origin despite forged destination headers", () => {
  assert.equal(checkMonthlyMutationRequest(mutation("https://reports.example.com", "application/json", { host: "evil.example.com" }), "https://reports.example.com"), null);
  assert.equal(checkMonthlyMutationRequest(mutation("https://evil.example.com", "application/json", { host: "evil.example.com" }), "https://reports.example.com")?.status, 403);
});
