import { useState, useEffect, useRef, useCallback } from "react";
import { AppState, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import * as Apple from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { auth, api, CreatedApp, Job, Account } from "./client";
export function useStudio() {
  const [session, setSession] = useState<Session | null>(null);
  const [apps, setApps] = useState<CreatedApp[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastRequestedId, setLastRequestedId] = useState<string | null>(null);
  const user = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const refresh = useCallback(async () => {
    const uid = user.current;
    if (!uid) return;
    // Fetch status first so a completed job is always followed by its latest source.
    const j = await api<Job[]>("/jobs");
    const [g, a] = await Promise.all([
      api<CreatedApp[]>("/apps"),
      api<Account>("/me"),
    ]);
    if (uid !== user.current) return;
    setApps(g);
    setAccount(a);
    setJob(j[0] ?? null);
    await AsyncStorage.setItem(`anything.apps.${uid}`, JSON.stringify(g));
  }, []);
  useEffect(() => {
    if (!auth) return;
    void auth.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = auth.auth.onAuthStateChange((_event, s) => setSession(s));
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        auth?.auth.startAutoRefresh();
        void refresh().catch(() => {});
      } else auth?.auth.stopAutoRefresh();
    });
    return () => {
      data.subscription.unsubscribe();
      sub.remove();
    };
  }, [refresh]);
  useEffect(() => {
    user.current = session?.user.id;
    setApps([]);
    setAccount(null);
    setJob(null);
    setLastRequestedId(null);
    setError("");
    const uid = session?.user.id;
    if (!uid) return;
    void (async () => {
      try {
        const cached = await AsyncStorage.getItem(`anything.apps.${uid}`);
        if (cached && user.current === uid) setApps(JSON.parse(cached));
      } catch {}
      try {
        await refresh();
      } catch (e) {
        if (user.current === uid) setError((e as Error).message);
      }
    })();
  }, [session?.user.id, refresh]);
  useEffect(() => {
    if (job?.status !== "pending") return;
    const timer = setInterval(() => void refresh().catch(() => {}), 2500);
    return () => clearInterval(timer);
  }, [job?.status, refresh]);
  async function signIn() {
    if (!auth) return;
    setError("");
    setBusy(true);
    try {
      const nonce = Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce
      );
      const credential = await Apple.signInAsync({
        requestedScopes: [
          Apple.AppleAuthenticationScope.EMAIL,
          Apple.AppleAuthenticationScope.FULL_NAME,
        ],
        nonce: hashed,
      });
      if (!credential.identityToken)
        throw new Error("Apple didn’t return a sign-in token.");
      const { error } = await auth.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
        nonce,
      });
      if (error) throw error;
    } catch (e) {
      if ((e as { code?: string }).code !== "ERR_REQUEST_CANCELED")
        setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function generate(prompt: string, appId?: string) {
    if (lock.current || job?.status === "pending") return;
    lock.current = true;
    setBusy(true);
    setError("");
    const uid = user.current;
    // Persist the request ID before sending so a lost response can be retried without another charge.
    const requestKey = `anything.request.${uid}`;
    try {
      if (!account?.adult_declared_at) {
        const adult = await new Promise<boolean>(resolve => Alert.alert('Create with AI · 18+', 'AI can create a wide range of content. You must be 18 or older to create and use generated apps.', [{text:'Cancel',style:'cancel',onPress:()=>resolve(false)},{text:'I’m 18 or older',onPress:()=>resolve(true)}], {cancelable:true,onDismiss:()=>resolve(false)}));
        if (!adult) return;
        await api('/account/age', {adult: true});
      }
      const consentKey = `anything.ai-consent.${uid}`;
      if (!(await AsyncStorage.getItem(consentKey))) {
        const allowed = await new Promise<boolean>((resolve) =>
          Alert.alert(
            "Share with Anthropic?",
            "To build or revise your app, your prompt and existing app code are sent to Anthropic. This includes any personal information you put in them. Your prompts and apps are saved to your account in Supabase. Your Apple account credentials are never sent to Anthropic.",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              { text: "Allow & create", onPress: () => resolve(true) },
            ],
            { cancelable: true, onDismiss: () => resolve(false) }
          )
        );
        if (!allowed) return;
        await AsyncStorage.setItem(consentKey, "v1");
      }
      const stored = await AsyncStorage.getItem(requestKey);
      const previous = stored ? JSON.parse(stored) : null;
      const payload =
        previous?.prompt === prompt && previous?.appId === (appId ?? null)
          ? previous
          : { requestId: Crypto.randomUUID(), prompt, appId: appId ?? null };
      await AsyncStorage.setItem(requestKey, JSON.stringify(payload));
      const result = await api<Job>("/generateApp", payload);
      if (user.current === uid) { setJob(result); setLastRequestedId(result.id); }
      await AsyncStorage.removeItem(requestKey);
      await refresh();
    } catch (e) {
      if (user.current === uid) setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function save(app: CreatedApp, saved = true) {
    setError("");
    try {
      await api(`/apps/${app.id}`, { saved }, "PATCH");
      await refresh();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function report(appId: string) {
    try { await api('/reports', {appId, reason: 'Problem or inappropriate generated content'}); Alert.alert('Report received', 'We’ll review this app. You can remove it from your library.'); }
    catch (e) { Alert.alert('Couldn’t send report', (e as Error).message); }
  }
  async function remove(appId: string) {
    try { await api(`/apps/${appId}`, undefined, 'DELETE'); await AsyncStorage.removeItem(`anything.data.${user.current}.${appId}`); await refresh(); return true; }
    catch(e) { setError((e as Error).message); return false; }
  }
  async function withdrawConsent() {
    await AsyncStorage.removeItem(`anything.ai-consent.${user.current}`);
    Alert.alert(
      "Permission withdrawn",
      "We’ll ask again before sending another prompt to Anthropic."
    );
  }
  async function signOut() {
    const result = await auth?.auth.signOut();
    if (result?.error) setError(result.error.message);
  }
  async function deleteAccount() {
    try {
      await api("/account", undefined, "DELETE");
      const uid = user.current;
      const keys = (await AsyncStorage.getAllKeys()).filter(key => key === `anything.apps.${uid}` || key === `anything.request.${uid}` || key === `anything.ai-consent.${uid}` || key.startsWith(`anything.data.${uid}.`));
      await AsyncStorage.multiRemove(keys);
      await auth?.auth.signOut({ scope: "local" });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    session,
    apps,
    account,
    job,
    error,
    busy,
    signIn,
    signOut,
    generate,
    save,
    refresh,
    deleteAccount,
    withdrawConsent,
    lastRequestedId,
    report,
    remove,
  };
}
export type Studio = ReturnType<typeof useStudio>;
