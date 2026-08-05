import assert from "node:assert/strict";
import test from "node:test";
import { WorkersAIProvider } from "./workers-ai-provider";
import { AIServiceError } from "./types";

const ACCOUNT = "acc123";
const TOKEN = "tok456";

/** Ganti global fetch untuk satu test, lalu kembalikan aslinya. */
function withFetch(
  impl: (url: string, init: RequestInit) => Promise<Response>,
  run: (calls: { url: string; init: RequestInit }[]) => Promise<void>
) {
  const original = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return impl(url, init);
  }) as typeof globalThis.fetch;
  return run(calls).finally(() => {
    globalThis.fetch = original;
  });
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

test("posts to the account-scoped endpoint with bearer auth and the prompt", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "halo" } }] }),
    async (calls) => {
      const provider = new WorkersAIProvider(ACCOUNT, TOKEN);
      const result = await provider.generateText("apa kabar");

      assert.equal(result.text, "halo");
      assert.equal(calls.length, 1);
      assert.equal(
        calls[0].url,
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`
      );

      const headers = calls[0].init.headers as Record<string, string>;
      assert.equal(headers.Authorization, `Bearer ${TOKEN}`);

      const body = JSON.parse(calls[0].init.body as string);
      assert.equal(body.model, "@cf/openai/gpt-oss-120b");
      assert.deepEqual(body.messages, [{ role: "user", content: "apa kabar" }]);
      // max_completion_tokens, bukan max_tokens yang sudah deprecated.
      assert.equal(body.max_completion_tokens, 4096);
      assert.equal("max_tokens" in body, false);
    }
  );
});

test("model dari konstruktor dan dari options saling menimpa dengan benar", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "x" } }] }),
    async (calls) => {
      const provider = new WorkersAIProvider(ACCOUNT, TOKEN, "@cf/custom/default");

      await provider.generateText("a");
      assert.equal(JSON.parse(calls[0].init.body as string).model, "@cf/custom/default");

      await provider.generateText("a", { model: "@cf/per/call" });
      assert.equal(JSON.parse(calls[1].init.body as string).model, "@cf/per/call");
    }
  );
});

test("temperature hanya dikirim kalau pemanggil menyetelnya", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "x" } }] }),
    async (calls) => {
      const provider = new WorkersAIProvider(ACCOUNT, TOKEN);

      await provider.generateText("a");
      assert.equal("temperature" in JSON.parse(calls[0].init.body as string), false);

      // 0 harus lolos — kalau dicek dengan truthiness, nilai ini hilang diam-diam
      // dan pemanggil yang minta deterministik justru dapat default provider.
      await provider.generateText("a", { temperature: 0 });
      assert.equal(JSON.parse(calls[1].init.body as string).temperature, 0);
    }
  );
});

test("status non-2xx jadi provider_error tanpa membocorkan body ke pesan", async () => {
  await withFetch(
    async () => new Response("akun xyz tidak punya kuota", { status: 429 }),
    async () => {
      const provider = new WorkersAIProvider(ACCOUNT, TOKEN);
      const error = await provider
        .generateText("a")
        .then(() => null, (e: unknown) => e);

      assert.ok(error instanceof AIServiceError);
      assert.equal(error.code, "provider_error");
      assert.equal(error.message.includes("xyz"), false);
    }
  );
});

test("anggaran token habis sebelum menjawab dijelaskan sebagai itu, bukan 'respons kosong'", async () => {
  // Kasus nyata: model reasoning seperti glm-5.2 menghabiskan seluruh anggaran
  // untuk bernalar dan mengembalikan 200 dengan content kosong. Pesan generik
  // mengirim orang mencari kesalahan di prompt atau kredensial.
  await withFetch(
    async () =>
      jsonResponse({
        choices: [{ finish_reason: "length", message: { content: "" } }],
      }),
    async () => {
      const provider = new WorkersAIProvider(ACCOUNT, TOKEN);
      const error = await provider
        .generateText("a")
        .then(() => null, (e: unknown) => e);

      assert.ok(error instanceof AIServiceError);
      assert.equal(error.code, "invalid_response");
      assert.match(error.message, /4096 token/);
      assert.match(error.message, /reasoning/);
    }
  );
});

test("respons 200 dengan konten kosong ditolak, bukan diteruskan sebagai string kosong", async () => {
  for (const payload of [
    { choices: [{ message: { content: "" } }] },
    { choices: [{ message: { content: "   " } }] },
    { choices: [{ message: {} }] },
    { choices: [] },
    {},
  ]) {
    await withFetch(
      async () => jsonResponse(payload),
      async () => {
        const provider = new WorkersAIProvider(ACCOUNT, TOKEN);
        const error = await provider
          .generateText("a")
          .then(() => null, (e: unknown) => e);

        assert.ok(
          error instanceof AIServiceError,
          `payload ${JSON.stringify(payload)} seharusnya ditolak`
        );
        assert.equal(error.code, "invalid_response");
      }
    );
  }
});

test("kegagalan jaringan jadi provider_error, bukan lolos sebagai TypeError", async () => {
  await withFetch(
    async () => {
      throw new Error("network down");
    },
    async () => {
      const provider = new WorkersAIProvider(ACCOUNT, TOKEN);
      const error = await provider
        .generateText("a")
        .then(() => null, (e: unknown) => e);

      assert.ok(error instanceof AIServiceError);
      assert.equal(error.code, "provider_error");
    }
  );
});
