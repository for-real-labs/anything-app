import test from "node:test";
import assert from "node:assert/strict";
import { generateApp, allowedUser } from "./generator.mjs";
test("only verified Apple accounts can generate", () => {
  assert.equal(allowedUser(null), false);
  assert.equal(
    allowedUser({
      email_confirmed_at: "now",
      app_metadata: { provider: "email" },
    }),
    false
  );
  assert.equal(
    allowedUser({
      is_anonymous: true,
      email_confirmed_at: "now",
      app_metadata: { provider: "apple" },
    }),
    false
  );
  assert.equal(
    allowedUser({
      email_confirmed_at: "now",
      app_metadata: { provider: "apple" },
    }),
    true
  );
});
test("revision sends existing source and returns full HTML without restricting Three.js", async () => {
  let payload;
  const html =
    '<html><script type="module">import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";</script></html>';
  const result = await generateApp("Make it 3D", "old source", {
    key: "test",
    model: "test",
    fetcher: async (_url, args) => {
      payload = JSON.parse(args.body);
      return {
        ok: true,
        json: async () => ({
          stop_reason: "tool_use",
          content: [
            {
              type: "tool_use",
              name: "deliver_app",
              input: { title: "Moon", html },
            },
          ],
        }),
      };
    },
  });
  assert.equal(result.html, html);
  assert.match(payload.messages[0].content, /old source/);
  assert.match(payload.messages[0].content, /Make it 3D/);
});
test("truncated output fails instead of replacing saved app", async () => {
  await assert.rejects(
    () =>
      generateApp("app", null, {
        key: "test",
        model: "test",
        fetcher: async () => ({
          ok: true,
          json: async () => ({
            stop_reason: "max_tokens",
            content: [
              {
                type: "tool_use",
                name: "deliver_app",
                input: { title: "Broken", html: "partial" },
              },
            ],
          }),
        }),
      }),
    /incomplete/
  );
});
