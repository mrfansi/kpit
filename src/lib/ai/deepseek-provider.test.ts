import assert from "node:assert/strict";
import test from "node:test";
import { DeepSeekProvider } from "./deepseek-provider";
import { AIServiceError } from "./types";

const KEY = "sk-test456";

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

test("posts to DeepSeek chat completions with bearer auth, thinking off and a token cap", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "halo" } }] }),
    async (calls) => {
      const provider = new DeepSeekProvider(KEY);
      const result = await provider.generateText("apa kabar");

      assert.equal(result.text, "halo");
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://api.deepseek.com/chat/completions");

      const headers = calls[0].init.headers as Record<string, string>;
      assert.equal(headers.Authorization, `Bearer ${KEY}`);

      const body = JSON.parse(calls[0].init.body as string);
      assert.equal(body.model, "deepseek-flash");
      assert.deepEqual(body.messages, [{ role: "user", content: "apa kabar" }]);
      // Thinking mode would ignore temperature and spend the cap on reasoning.
      assert.deepEqual(body.thinking, { type: "disabled" });
      assert.equal(body.max_tokens, 4096);
    }
  );
});

test("empty DEEPSEEK_MODEL falls back to the default model", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "x" } }] }),
    async (calls) => {
      await new DeepSeekProvider(KEY, "").generateText("a");
      assert.equal(JSON.parse(calls[0].init.body as string).model, "deepseek-flash");
    }
  );
});

test("model dari konstruktor dan dari options saling menimpa dengan benar", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "x" } }] }),
    async (calls) => {
      const provider = new DeepSeekProvider(KEY, "deepseek-v4-pro");

      await provider.generateText("a");
      assert.equal(JSON.parse(calls[0].init.body as string).model, "deepseek-v4-pro");

      await provider.generateText("a", { model: "deepseek-per-call" });
      assert.equal(JSON.parse(calls[1].init.body as string).model, "deepseek-per-call");
    }
  );
});

test("temperature hanya dikirim kalau pemanggil menyetelnya", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ message: { content: "x" } }] }),
    async (calls) => {
      const provider = new DeepSeekProvider(KEY);

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
      const provider = new DeepSeekProvider(KEY);
      const error = await provider
        .generateText("a")
        .then(() => null, (e: unknown) => e);

      assert.ok(error instanceof AIServiceError);
      assert.equal(error.code, "provider_error");
      assert.equal(error.message.includes("xyz"), false);
    }
  );
});

test("truncated answers are rejected even when partial text exists", async () => {
  for (const [finish_reason, content, expected] of [
    ["length", "", /4096 token.*habis/],
    ["length", "Narasi laporan yang terpotong di tengah kal", /4096 token.*habis/],
    ["insufficient_system_resource", "Sebagian jawaban", /insufficient_system_resource/],
    ["aborted", "Sebagian jawaban", /aborted/],
  ] as const) {
    await withFetch(
      async () => jsonResponse({ choices: [{ finish_reason, message: { content } }] }),
      async () => {
        const error = await new DeepSeekProvider(KEY)
          .generateText("a")
          .then(() => null, (e: unknown) => e);

        assert.ok(error instanceof AIServiceError, `${finish_reason} + ${JSON.stringify(content)} must be rejected`);
        assert.equal(error.code, "invalid_response");
        assert.match(error.message, expected);
      }
    );
  }
});

test("finish_reason stop returns the text", async () => {
  await withFetch(
    async () => jsonResponse({ choices: [{ finish_reason: "stop", message: { content: "lengkap" } }] }),
    async () => {
      assert.equal((await new DeepSeekProvider(KEY).generateText("a")).text, "lengkap");
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
        const provider = new DeepSeekProvider(KEY);
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
      const provider = new DeepSeekProvider(KEY);
      const error = await provider
        .generateText("a")
        .then(() => null, (e: unknown) => e);

      assert.ok(error instanceof AIServiceError);
      assert.equal(error.code, "provider_error");
    }
  );
});
