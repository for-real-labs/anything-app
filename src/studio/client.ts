import "react-native-url-polyfill/auto";
import { studioConfig } from "./config";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
// Public project configuration only. Server credentials never belong in this bundle.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL || studioConfig.url;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || studioConfig.anonKey;
export const apiUrl =
  process.env.EXPO_PUBLIC_APP_API_URL || studioConfig.apiUrl;
export const configured = !!(url && key && apiUrl);
const storage = {
  getItem: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.getItem(key))
      : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.setItem(key, value))
      : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === "web"
      ? Promise.resolve(sessionStorage.removeItem(key))
      : SecureStore.deleteItemAsync(key),
};
export const auth = configured
  ? createClient(url!, key!, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
export async function api<T>(
  path: string,
  body?: unknown,
  method?: string
): Promise<T> {
  if (!auth || !apiUrl) throw new Error("App creation isn’t configured yet.");
  const {
    data: { session },
    error,
  } = await auth.auth.getSession();
  if (error || !session) throw new Error("Sign in to create apps.");
  const response = await fetch(apiUrl + path, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "Couldn’t connect. Try again.");
  return result as T;
}
export type CreatedApp = {
  id: string;
  title: string;
  html: string;
  saved: boolean;
  revision: number;
  updated_at: string;
};
export type Job = {
  id: string;
  app_id: string | null;
  status: "pending" | "complete" | "failed";
  error: string | null;
};
export type Account = { credits: number; unlimited: boolean; adult_declared_at: string | null };
