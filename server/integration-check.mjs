// Creates disposable admin-verified test identities; does not test Apple’s interactive sign-in.
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const base = process.env.APP_API_URL;
const url = process.env.SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anon = process.env.SUPABASE_ANON_KEY;
if (!base || !url || !service || !anon)
  throw new Error(
    "Set APP_API_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_ANON_KEY for a dedicated test project."
  );
const admin = createClient(url, service, { auth: { persistSession: false } });
const users = [];
async function makeUser(apple = true) {
  const email = `studio-test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID() + "Aa1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      provider: apple ? "apple" : "email",
      providers: [apple ? "apple" : "email"],
    },
  });
  if (error) throw error;
  users.push(data.user.id);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (link.error) throw link.error;
  const login = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "email",
  });
  if (login.error) throw login.error;
  if (apple)
    await admin.auth.admin.updateUserById(data.user.id, {
      app_metadata: { provider: "apple", providers: ["apple"] },
    });
  return { id: data.user.id, token: login.data.session.access_token, client };
}
async function call(user, path, body, method) {
  const r = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${user?.token || "invalid"}`,
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
try {
  assert.equal((await call(null, "/me")).status, 401);
  const user = await makeUser();
  const other = await makeUser();
  const nonApple = await makeUser(false);
  assert.equal((await call(nonApple, "/me")).status, 401);
  console.log("PASS unauthenticated and non-Apple rejection");
  const account = await call(user, "/me");
  await call(user, "/account/age", { adult: true });
  assert.equal(account.data.credits, 10, JSON.stringify(account));
  const jid = crypto.randomUUID();
  const reserve = await admin.rpc("reserve_app_job", {
    uid: user.id,
    jid,
    gid: null,
    instruction: "credit test",
  });
  if (reserve.error) throw reserve.error;
  await admin.rpc("reserve_app_job", {
    uid: user.id,
    jid,
    gid: null,
    instruction: "credit test",
  });
  assert.equal((await call(user, "/me")).data.credits, 9);
  await Promise.all([
    admin.rpc("fail_app_job", { jid, reason: "test" }),
    admin.rpc("fail_app_job", { jid, reason: "test" }),
  ]);
  assert.equal((await call(user, "/me")).data.credits, 10);
  console.log("PASS idempotent charge and concurrent refund");
  const creditWrite = await user.client
    .from("app_accounts")
    .update({ credits: 9999 })
    .eq("user_id", user.id);
  assert.ok(creditWrite.error);
  console.log("PASS client cannot change credits");
  if (process.env.RUN_LIVE_GENERATION !== "1") {
    console.log(
      "Live generation skipped; set RUN_LIVE_GENERATION=1 to spend provider tokens."
    );
    process.exitCode = 0;
  } else {
    const requestId = crypto.randomUUID();
    const created = await call(user, "/generateApp", {
      requestId,
      prompt:
        "Build a very small playable 3D Three.js app: tap a rotating colorful cube to score points. Use Three.js pinned HTTPS module import. Include a score and reset. Keep all code under 100 lines.",
    });
    assert.equal(created.status, 202, JSON.stringify(created.data));
    console.log("Generation accepted");
    let job;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      job = (await call(user, `/jobs/${requestId}`)).data;
      if (job.status !== "pending") break;
    }
    assert.equal(job.status, "complete", JSON.stringify(job));
    const apps = (await call(user, "/apps")).data;
    const app = apps.find((g) => g.id === job.app_id);
    assert.ok(app.html.includes("three"));
    assert.equal(app.saved, false);
    assert.equal(
      (await call(other, `/apps/${app.id}`, { saved: true }, "PATCH")).status,
      404
    );
    assert.equal((await call(other, `/jobs/${requestId}`)).status, 404);
    assert.equal(
      (await call(user, `/apps/${app.id}`, { saved: true }, "PATCH")).data
        .saved,
      true
    );
    assert.equal((await call(user, "/me")).data.credits, 9);

    console.log(
      "PASS live Three.js generation, save, credits, and cross-account isolation"
    );
    const revisionId = crypto.randomUUID();
    await call(user, "/generateApp", {
      requestId: revisionId,
      appId: app.id,
      prompt:
        "Change the background to dark navy, and make each tap worth 2 points. Keep everything else.",
    });
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      job = (await call(user, `/jobs/${revisionId}`)).data;
      if (job.status !== "pending") break;
    }
    assert.equal(job.status, "complete", JSON.stringify(job));
    const revised = (await call(user, "/apps")).data.find(
      (g) => g.id === app.id
    );
    assert.equal(revised.revision, 2);
    assert.equal(revised.saved, true);
    assert.notEqual(revised.html, app.html);
    assert.equal((await call(user, "/me")).data.credits, 8);
    console.log("PASS live revision preserves saved dashboard app");
  }
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
  console.log("Test accounts cleaned up");
}
