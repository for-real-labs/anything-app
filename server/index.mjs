import express from "express";
import { createClient } from "@supabase/supabase-js";
import { generateApp, allowedUser } from "./generator.mjs";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY } =
  process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ANTHROPIC_API_KEY)
  throw new Error("Missing backend configuration");
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get('/.well-known/apple-app-site-association', (_req,res)=>res.json({applinks:{details:[{appIDs:['F3M935826C.com.forreallabs.anythingapp'],components:[{'/':'/apps/*'}]}]}}));
app.get('/apps/:id', (req,res)=>res.type('html').send('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anything App</title><body style="font:20px system-ui;padding:40px;background:#F7F8FC"><h1>Your private app.</h1><p>Open Anything App and sign in to the account that owns this app. You’ll find it in your library.</p><a href="https://for-real-labs.github.io/anything-app/">About Anything App</a></body>'));
app.use(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token)
      return res.status(401).json({ error: "Sign in to create apps." });
    const { data, error } = await db.auth.getUser(token);
    if (error || !allowedUser(data.user, process.env.APPLE_ONLY !== "false"))
      return res
        .status(401)
        .json({ error: "Sign in with Apple to create apps." });
    req.user = data.user;
    next();
  } catch {
    res.status(503).json({ error: "Sign-in is temporarily unavailable." });
  }
});
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const uuid = (s) =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
app.get("/me", async (req, res) => {
  const account = check(
    await db.rpc("ensure_app_account", { uid: req.user.id })
  );
  const stale = check(
    await db
      .from("app_jobs")
      .select("id")
      .eq("user_id", req.user.id)
      .eq("status", "pending")
      .lt("created_at", new Date(Date.now() - 600000).toISOString())
  );
  for (const job of stale)
    check(
      await db.rpc("fail_app_job", {
        jid: job.id,
        reason: "Generation interrupted. Your credit was returned.",
      })
    );
  res.json(
    stale.length
      ? check(await db.rpc("ensure_app_account", { uid: req.user.id }))
      : account
  );
});
app.post('/account/age', async(req,res)=>{
 if(req.body.adult!==true)return res.status(400).json({error:'You must be 18 or older to create apps.'});
 check(await db.rpc('ensure_app_account',{uid:req.user.id}));
 check(await db.from('app_accounts').update({adult_declared_at:new Date().toISOString()}).eq('user_id',req.user.id));
 res.json({ok:true});
});
app.post('/reports', async(req,res)=>{
 const {appId,reason}=req.body;
 if(!uuid(appId)||typeof reason!=='string'||!reason.trim()||reason.length>2000)return res.status(400).json({error:'Invalid report.'});
 const own=check(await db.from('created_apps').select('id').eq('id',appId).eq('user_id',req.user.id).maybeSingle());
 if(!own)return res.status(404).json({error:'App not found.'});
 const recent=check(await db.from('app_reports').select('id').eq('user_id',req.user.id).gte('created_at',new Date(Date.now()-86400000).toISOString()));
 if(recent.length>=10)return res.status(429).json({error:'Report limit reached. Please contact support.'});
 check(await db.from('app_reports').insert({user_id:req.user.id,app_id:appId,reason:reason.trim()}));
 res.json({ok:true});
});
app.delete('/apps/:id', async(req,res)=>{
 if(!uuid(req.params.id))return res.status(400).json({error:'Invalid app.'});
 const pending=check(await db.from('app_jobs').select('id').eq('app_id',req.params.id).eq('user_id',req.user.id).eq('status','pending'));
 if(pending.length)return res.status(409).json({error:'Wait for the update to finish before deleting this app.'});
 const removed=check(await db.from('created_apps').delete().eq('id',req.params.id).eq('user_id',req.user.id).select('id').maybeSingle());
 if(!removed)return res.status(404).json({error:'App not found.'});
 res.json({ok:true});
});
app.get("/apps", async (req, res) =>
  res.json(
    check(
      await db
        .from("created_apps")
        .select("*")
        .eq("user_id", req.user.id)
        .order("updated_at", { ascending: false })
    )
  )
);
app.patch("/apps/:id", async (req, res) => {
  if (!uuid(req.params.id) || typeof req.body.saved !== "boolean")
    return res.status(400).json({ error: "Invalid app." });
  const app = check(
    await db
      .from("created_apps")
      .update({ saved: req.body.saved })
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .select()
      .maybeSingle()
  );
  if (!app) return res.status(404).json({ error: "App not found." });
  res.json(app);
});
const running = new Set();
async function run(job) {
  if (running.has(job.id)) return;
  running.add(job.id);
  try {
    const claimed = check(
      await db
        .from("app_jobs")
        .update({ worker_claimed: true })
        .eq("id", job.id)
        .eq("status", "pending")
        .eq("worker_claimed", false)
        .select("id")
        .maybeSingle()
    );
    if (!claimed) return;
    const old = job.app_id
      ? check(
          await db
            .from("created_apps")
            .select("html")
            .eq("id", job.app_id)
            .eq("user_id", job.user_id)
            .single()
        )
      : null;
    const app = await generateApp(job.prompt, old?.html, {
      key: ANTHROPIC_API_KEY,
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    });
    check(
      await db.rpc("complete_app_job", {
        jid: job.id,
        app_title: app.title,
        app_html: app.html,
      })
    );
  } catch (e) {
    console.error("Generation failed", job.id, e.message);
    await db.rpc("fail_app_job", {
      jid: job.id,
      reason: e.message?.startsWith("CONTENT_REFUSED:") ? "This request can’t be created. Try a different idea. Your credit was returned." : "Couldn’t finish this app. Your credit was returned.",
    });
  } finally {
    running.delete(job.id);
  }
}
app.post("/generateApp", async (req, res) => {
  const account = check(await db.rpc('ensure_app_account',{uid:req.user.id}));
  if(!account.adult_declared_at)return res.status(403).json({error:'Confirm you are 18 or older before creating apps.'});
  const { requestId, appId = null, prompt } = req.body;
  if (
    !uuid(requestId) ||
    (appId !== null && !uuid(appId)) ||
    typeof prompt !== "string" ||
    !prompt.trim() ||
    prompt.length > 12000
  )
    return res
      .status(400)
      .json({ error: "Enter a prompt up to 12,000 characters." });
  const { data: existing, error: lookupError } = await db
    .from("app_jobs")
    .select("*")
    .eq("id", requestId)
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) {
    if (existing.status === "pending") void run(existing);
    return res.status(202).json(existing);
  }
  const { data: job, error } = await db.rpc("reserve_app_job", {
    uid: req.user.id,
    jid: requestId,
    gid: appId,
    instruction: prompt,
  });
  if (error) return res.status(409).json({ error: error.message });
  if (job.status === "pending") void run(job);
  res.status(202).json(job);
});
app.get("/jobs", async (req, res) =>
  res.json(
    check(
      await db
        .from("app_jobs")
        .select("*")
        .eq("user_id", req.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
    )
  )
);
app.get("/jobs/:id", async (req, res) => {
  if (!uuid(req.params.id))
    return res.status(400).json({ error: "Invalid request." });
  const job = check(
    await db
      .from("app_jobs")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", req.user.id)
      .maybeSingle()
  );
  if (!job) return res.status(404).json({ error: "Request not found." });
  res.json(job);
});
app.delete("/account", async (req, res) => {
  check(await db.auth.admin.deleteUser(req.user.id));
  res.json({ ok: true });
});
app.use((err, req, res, _next) => {
  console.error("Request failed", req.path, err.message);
  res
    .status(err.status === 413 ? 413 : 500)
    .json({ error: "Couldn’t complete the request. Please try again." });
});
app.listen(process.env.PORT || 3000, "0.0.0.0");
