import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { Lora_500Medium } from "@expo-google-fonts/lora";
import * as Apple from "expo-apple-authentication";
import { useStudio, Studio } from "./src/studio/useStudio";
import { CreatedApp } from "./src/studio/client";
import { starters, suggestions } from "./src/studio/starters";
import { appDataKey } from "./src/studio/persistence";
import { AppPlayer } from "./src/components/AppPlayer";
import { Button } from "./src/components/Button";
import { colors as c, fonts as f } from "./src/theme";
const support = "https://for-real-labs.github.io/anything-app/";
const palettes = [
  ["#ECE7FF", "#8270C7"],
  ["#E4F0E9", "#628575"],
  ["#FFF0DE", "#BE8953"],
  ["#E3EDF9", "#7096C6"],
  ["#F8E5EE", "#B67896"],
];
function AppTile({
  app,
  index,
  onPress,
}: {
  app: CreatedApp;
  index: number;
  onPress: () => void;
}) {
  const p = palettes[index % palettes.length];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${app.title}`}
      onPress={onPress}
      style={({ pressed }) => [s.tile, { opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[s.tileIcon, { backgroundColor: p[0] }]}>
        <Text style={{ fontSize: 28, color: p[1] }}>
          {["◷", "✓", "≡", "◇", "✧"][index % 5]}
        </Text>
      </View>
      <Text style={s.tileTitle} numberOfLines={2}>
        {app.title}
      </Text>
      <Text style={s.tileSub}>
        {app.id.startsWith("starter-") ? "Made to try" : "Made by you"}{" "}
        <Text style={{ color: p[1] }}>↗</Text>
      </Text>
    </Pressable>
  );
}
function Creator({
  studio,
  initialId,
  initialPrompt,
  onSaved,
  onOpen,
}: {
  studio: Studio;
  initialId: string | null;
  initialPrompt: string;
  onSaved: () => void;
  onOpen: (app: CreatedApp) => void;
}) {
  const [id, setId] = useState(initialId),
    [prompt, setPrompt] = useState(initialPrompt),
    [saving, setSaving] = useState(false),
    [appleAvailable, setAppleAvailable] = useState(false);
  const app = studio.apps.find((g) => g.id === id),
    generating = studio.job?.status === "pending";
  useEffect(() => {
    void Apple.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (
      studio.job?.status === "complete" &&
      studio.job.app_id &&
      studio.job.id === studio.lastRequestedId
    ) {
      setId(studio.job.app_id);
      setPrompt("");
    }
  }, [studio.job?.status, studio.job?.id, studio.lastRequestedId]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.page}
      >
        <Text style={s.eyebrow}>
          {app ? "MAKE IT YOURS" : "FROM IDEA TO APP"}
        </Text>
        <Text style={s.title}>
          {app ? app.title : "What would you\nlove to make?"}
        </Text>
        <Text style={s.subtitle}>
          {app
            ? "A little change. A whole new possibility."
            : "A useful little tool. A fun little world. Anything."}
        </Text>
        <TextInput
          accessibilityLabel={
            app ? "Describe your changes" : "Describe your app"
          }
          value={prompt}
          onChangeText={setPrompt}
          multiline
          maxLength={12000}
          editable={!generating && !studio.busy}
          placeholder={
            app ? "What would you like to change?" : "An app that helps me…"
          }
          placeholderTextColor="#9C98AE"
          style={s.input}
        />
        {!studio.session ? (
          <View style={s.signIn}>
            <Text style={s.note}>
              Sign in to create and save. 10 free credits.
            </Text>
            {appleAvailable ? (
              <Apple.AppleAuthenticationButton
                buttonType={Apple.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={18}
                style={{ height: 56, width: "100%" }}
                onPress={() => void studio.signIn()}
              />
            ) : (
              <Text style={s.note}>
                Sign in with Apple on your iPhone or iPad.
              </Text>
            )}
          </View>
        ) : (
          <>
            <Button
              label={
                generating
                  ? "Creating your app…"
                  : app
                  ? "Update app"
                  : "Create app"
              }
              disabled={generating || studio.busy || !prompt.trim()}
              onPress={() => void studio.generate(prompt, id ?? undefined)}
            />
            <Text style={[s.note, { textAlign: "center" }]}>
              {studio.account?.unlimited
                ? "Unlimited credits"
                : `${studio.account?.credits ?? "…"} credits`}{" "}
              · 1 per creation or revision
            </Text>
          </>
        )}
        {generating && (
          <View style={s.progress}>
            <ActivityIndicator color={c.primary} />
            <Text style={s.note}>
              Bringing your idea to life. You can come back later.
            </Text>
          </View>
        )}
        {!!studio.error && (
          <Text accessibilityRole="alert" style={s.error}>
            {studio.error}
          </Text>
        )}
        {studio.job?.status === "failed" && (
          <Text style={s.error}>{studio.job.error}</Text>
        )}
        {app && (
          <View style={s.result}>
            <View style={s.resultTop}>
              <Text style={s.section}>Ready to try.</Text>
              <Text style={s.pill}>VERSION {app.revision}</Text>
            </View>
            <Button label="Open app ↗" onPress={() => onOpen(app)} />
            <Button
              quiet
              label={
                saving
                  ? "Saving…"
                  : app.saved
                  ? "Saved to your apps ✓"
                  : "Save to my apps"
              }
              disabled={saving || generating || app.saved}
              onPress={() => {
                setSaving(true);
                void studio
                  .save(app)
                  .then((ok) => {
                    if (ok) onSaved();
                  })
                  .finally(() => setSaving(false));
              }}
            />
          </View>
        )}
        {!app && !generating && (
          <>
            <Text style={[s.section, { marginTop: 12 }]}>
              A little inspiration
            </Text>
            <View style={s.suggestions}>
              {suggestions.map((v) => (
                <Pressable
                  key={v.title}
                  accessibilityRole="button"
                  onPress={() => setPrompt(v.prompt)}
                  style={s.suggestion}
                >
                  <Text style={s.suggestionIcon}>{v.icon}</Text>
                  <Text style={s.suggestionText}>{v.title}</Text>
                  <Text style={s.chevron}>↗</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <Text style={[s.note, { fontSize: 12, marginTop: 8 }]}>
          Apps run inside Anything App. Camera, contacts, payments, and native
          device features aren’t available.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Main() {
  const studio = useStudio();
  const [screen, setScreen] = useState<
      "home" | "create" | "player" | "settings" | "source"
    >("home"),
    [selected, setSelected] = useState<CreatedApp | null>(null),
    [prompt, setPrompt] = useState(""),
    [refreshing, setRefreshing] = useState(false);
  const saved = studio.apps.filter((a) => a.saved),
    drafts = studio.apps.filter((a) => !a.saved);
  const current = studio.apps.find((a) => a.id === selected?.id) ?? selected;
  function open(app: CreatedApp) {
    setSelected(app);
    setScreen("player");
  }
  function create(id: string | null = null) {
    setSelected(studio.apps.find((a) => a.id === id) ?? null);
    setPrompt("");
    setScreen("create");
  }
  useEffect(() => {
    const handle = (url: string) => {
      const id = url.match(/(?:apps\/|app\/)([\w-]+)/)?.[1];
      const found = [...studio.apps, ...starters].find((a) => a.id === id);
      if (found) open(found);
      else if (id)
        Alert.alert(
          "Your private app",
          "Sign in to the account that owns this app, then open it from My apps."
        );
    };
    const sub = Linking.addEventListener("url", (e) => handle(e.url));
    void Linking.getInitialURL().then((url) => {
      if (url) handle(url);
    });
    return () => sub.remove();
  }, [studio.apps]);
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={s.nav}>
        {screen === "home" ? (
          <View style={s.brand}>
            <Image source={require("./assets/icon.png")} style={s.brandIcon} />
            <Text style={s.brandName}>
              anything<Text style={{ color: c.primary }}>.</Text>
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen(screen === "source" ? "player" : "home")}
            style={s.back}
          >
            <Text style={s.backText}>
              ‹ {screen === "source" ? "App" : "My apps"}
            </Text>
          </Pressable>
        )}
        {screen === "player" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setScreen("source")}
            style={s.navButton}
          >
            <Text style={s.navLabel}>{"</>"}</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => setScreen("settings")}
            style={s.navButton}
          >
            <Text style={s.navLabel}>•••</Text>
          </Pressable>
        )}
      </View>
      {screen === "home" && (
        <ScrollView
          contentContainerStyle={s.page}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void studio
                  .refresh()
                  .catch(() => {})
                  .finally(() => setRefreshing(false));
              }}
            />
          }
        >
          <Text style={s.eyebrow}>A HOME FOR YOUR IDEAS</Text>
          <Text style={s.homeTitle}>Little apps.\nEndless possibilities.</Text>
          <Text style={s.subtitle}>Imagine it. Make it. Make it yours.</Text>
          <View style={s.hero}>
            <Image
              source={require("./assets/hero.png")}
              resizeMode="cover"
              style={s.heroImage}
            />
            <View style={s.heroFooter}>
              <Text style={s.heroTitle}>What will you make?</Text>
              <Text style={s.heroCaption}>Start with a thought.</Text>
            </View>
          </View>
          <Button label="＋  Create app" onPress={() => create()} />
          {studio.job?.status === "pending" && (
            <Pressable
              accessibilityRole="button"
              onPress={() => create(studio.job?.app_id ?? null)}
              style={s.pending}
            >
              <ActivityIndicator color={c.primary} />
              <Text style={s.note}>Your app is taking shape…</Text>
              <Text style={s.chevron}>↗</Text>
            </Pressable>
          )}
          {!!studio.error && <Text style={s.error}>{studio.error}</Text>}
          {saved.length > 0 && (
            <>
              <View style={s.sectionRow}>
                <Text style={s.section}>Made by you</Text>
                <Text style={s.count}>{saved.length}</Text>
              </View>
              <View style={s.grid}>
                {saved.map((a, i) => (
                  <AppTile
                    key={a.id}
                    app={a}
                    index={i + 3}
                    onPress={() => open(a)}
                  />
                ))}
              </View>
            </>
          )}
          {drafts.length > 0 && (
            <>
              <Text style={s.section}>Ready to finish</Text>
              {drafts.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="button"
                  onPress={() => create(a.id)}
                  style={s.draft}
                >
                  <Text style={s.suggestionText}>{a.title}</Text>
                  <Text style={s.chevron}>↗</Text>
                </Pressable>
              ))}
            </>
          )}
          <View style={s.sectionRow}>
            <Text style={s.section}>A few to get you started</Text>
            <Text style={s.pill}>TRY ONE</Text>
          </View>
          <View style={s.grid}>
            {starters.map((a, i) => (
              <AppTile key={a.id} app={a} index={i} onPress={() => open(a)} />
            ))}
          </View>
          <Text style={s.footer}>A little imagination goes a long way.</Text>
        </ScrollView>
      )}
      {screen === "create" && (
        <Creator
          key={selected?.id ?? "new"}
          studio={studio}
          initialId={selected?.id ?? null}
          initialPrompt={prompt}
          onOpen={open}
          onSaved={() => setScreen("home")}
        />
      )}
      {screen === "player" && current && (
        <View style={{ flex: 1 }}>
          <View style={s.playerBar}>
            <Text style={s.playerTitle} numberOfLines={1}>
              {current.title}
            </Text>
            {!current.id.startsWith("starter-") && (
              <Pressable
                accessibilityRole="button"
                onPress={() => create(current.id)}
                style={s.edit}
              >
                <Text style={s.editText}>Edit app</Text>
              </Pressable>
            )}
          </View>
          <AppPlayer
            key={current.id}
            html={current.html}
            storageKey={appDataKey(
              current.id.startsWith("starter-")
                ? "local"
                : studio.session?.user.id ?? "local",
              current.id
            )}
          />
          {!current.id.startsWith("starter-") && (
            <View style={s.bottomBar}>
              {!current.saved && (
                <Button
                  label="Save to my apps"
                  onPress={() =>
                    void studio.save(current).then((ok) => {
                      if (ok) setScreen("home");
                    })
                  }
                />
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    "Report this app?",
                    "The app source and your report will be sent to support for review.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Report",
                        onPress: () => void studio.report(current.id),
                      },
                    ]
                  )
                }
                style={{ padding: 10 }}
              >
                <Text style={s.reportText}>Report a problem</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    "Delete this app?",
                    "This removes its saved source and data from this device.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () =>
                          void studio.remove(current.id).then((ok) => {
                            if (ok) setScreen("home");
                          }),
                      },
                    ]
                  )
                }
                style={{ padding: 8 }}
              >
                <Text style={s.reportText}>Delete app</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
      {screen === "source" && current && (
        <ScrollView contentContainerStyle={[s.page, { maxWidth: 900 }]}>
          <Text style={s.section}>Under the hood</Text>
          <Text style={s.note}>
            The complete HTML, CSS, and JavaScript for {current.title}.
          </Text>
          <Text selectable style={s.code}>
            {current.html}
          </Text>
        </ScrollView>
      )}
      {screen === "settings" && (
        <ScrollView contentContainerStyle={s.page}>
          <Text style={s.title}>Your space.</Text>
          <Text style={s.subtitle}>A few things to keep handy.</Text>
          <View style={s.settingsCard}>
            <Button
              quiet
              label="Privacy & support ↗"
              onPress={() => void Linking.openURL(support)}
            />
            <Button
              quiet
              label="Contact support ↗"
              onPress={() => void Linking.openURL(support + "#support")}
            />
            {studio.session && (
              <>
                <Text style={[s.note, { textAlign: "center" }]}>
                  {studio.account?.unlimited
                    ? "Unlimited credits"
                    : `${studio.account?.credits ?? "…"} credits remaining`}
                </Text>
                <Button
                  quiet
                  label="Withdraw AI permission"
                  onPress={() => void studio.withdrawConsent()}
                />
                <Button
                  quiet
                  label="Sign out"
                  onPress={() =>
                    void studio.signOut().then(() => setScreen("home"))
                  }
                />
                <Button
                  quiet
                  label="Delete account"
                  onPress={() =>
                    Alert.alert(
                      "Delete your account?",
                      "Your apps, prompts, credits, and local app data will be permanently deleted.",
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete account",
                          style: "destructive",
                          onPress: () =>
                            void studio
                              .deleteAccount()
                              .then(() => setScreen("home")),
                        },
                      ]
                    )
                  }
                />
              </>
            )}
          </View>
          <Text style={s.note}>
            Your created apps are private to your account. App source syncs to
            your library. Data entered inside each app stays on this device.
          </Text>
          <Text style={s.note}>
            Create with AI for ages 18+. Generation requires internet. Apps that
            use online libraries or services also need a connection.
          </Text>
          <Text style={s.footer}>Anything App · 1.0</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
export default function App() {
  const [loaded, error] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Lora_500Medium,
  });
  return (
    <SafeAreaProvider>
      {loaded || error ? (
        <Main />
      ) : (
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            backgroundColor: c.paper,
          }}
        >
          <ActivityIndicator color={c.primary} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.paper },
  nav: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 58,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandIcon: { width: 30, height: 30, borderRadius: 9 },
  brandName: {
    fontFamily: f.bold,
    fontSize: 25,
    letterSpacing: -1,
    color: c.ink,
  },
  navButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: { fontFamily: f.bold, color: c.ink, fontSize: 20 },
  back: { minHeight: 44, justifyContent: "center" },
  backText: { fontFamily: f.medium, color: c.ink, fontSize: 17 },
  page: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 18,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    flexGrow: 1,
  },
  eyebrow: {
    fontFamily: f.bold,
    fontSize: 10,
    letterSpacing: 2,
    color: c.primary,
  },
  title: {
    fontFamily: f.bold,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -1.3,
    color: c.ink,
  },
  homeTitle: {
    fontFamily: f.bold,
    fontSize: 35,
    lineHeight: 39,
    letterSpacing: -1.5,
    color: c.ink,
  },
  subtitle: {
    fontFamily: f.body,
    fontSize: 16,
    lineHeight: 23,
    color: c.muted,
    marginTop: -7,
  },
  hero: {
    backgroundColor: "#EDEBF9",
    borderRadius: 25,
    overflow: "hidden",
    marginTop: 4,
  },
  heroImage: { width: "100%", height: 175 },
  heroFooter: { paddingHorizontal: 22, paddingBottom: 18, paddingTop: 10 },
  heroTitle: { fontFamily: f.bold, fontSize: 20, color: c.ink },
  heroCaption: {
    fontFamily: f.body,
    fontSize: 13,
    color: c.muted,
    marginTop: 4,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
  },
  section: { fontFamily: f.bold, fontSize: 18, color: c.ink },
  count: { fontFamily: f.medium, color: c.muted, fontSize: 14 },
  pill: {
    fontFamily: f.bold,
    fontSize: 9,
    letterSpacing: 1.2,
    color: c.primary,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.8%",
    flexGrow: 1,
    minWidth: 130,
    maxWidth: "49%",
    backgroundColor: c.surface,
    borderRadius: 23,
    padding: 18,
    borderWidth: 1,
    borderColor: "#EEEEF5",
  },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  tileTitle: { fontFamily: f.bold, fontSize: 16, color: c.ink },
  tileSub: { fontFamily: f.body, color: c.muted, fontSize: 11, marginTop: 6 },
  footer: {
    fontFamily: f.body,
    fontSize: 11,
    color: "#9793A8",
    textAlign: "center",
    marginTop: 12,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderColor: c.line,
    borderWidth: 1,
    borderRadius: 22,
    minHeight: 175,
    textAlignVertical: "top",
    padding: 20,
    fontFamily: f.body,
    fontSize: 17,
    lineHeight: 25,
    color: c.ink,
  },
  note: { fontFamily: f.body, fontSize: 13, lineHeight: 20, color: c.muted },
  signIn: { gap: 14 },
  progress: { padding: 20, gap: 16, alignItems: "center" },
  error: { fontFamily: f.body, color: c.error, fontSize: 14, lineHeight: 20 },
  suggestions: { gap: 10 },
  suggestion: {
    backgroundColor: "#FFFFFF",
    padding: 17,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  suggestionIcon: { fontSize: 22, color: c.primary, width: 25 },
  suggestionText: { fontFamily: f.medium, fontSize: 14, color: c.ink, flex: 1 },
  chevron: { color: c.primary, fontSize: 20 },
  result: {
    gap: 12,
    backgroundColor: "#EDEAF8",
    padding: 20,
    borderRadius: 22,
  },
  resultTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  pending: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: c.highlight,
    padding: 16,
    borderRadius: 18,
  },
  draft: {
    flexDirection: "row",
    padding: 18,
    borderRadius: 18,
    backgroundColor: c.surface,
  },
  playerBar: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  playerTitle: { fontFamily: f.bold, fontSize: 18, color: c.ink, flex: 1 },
  edit: {
    backgroundColor: c.highlight,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  editText: { fontFamily: f.medium, color: c.primary, fontSize: 13 },
  bottomBar: { paddingHorizontal: 24, paddingTop: 8 },
  reportText: {
    fontFamily: f.body,
    fontSize: 11,
    textAlign: "center",
    color: c.muted,
  },
  code: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 11,
    lineHeight: 18,
    color: c.ink,
  },
  settingsCard: {
    backgroundColor: c.surface,
    borderRadius: 22,
    padding: 10,
    gap: 8,
  },
});
