import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View, Text, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { playerDocument, parseStorageMessage } from "../studio/document";
import { createAppStorage } from "../studio/persistence";
const storage = createAppStorage(AsyncStorage);
export function AppPlayer({
  html,
  storageKey,
}: {
  html: string;
  storageKey: string;
}) {
  const [document, setDocument] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setDocument(null);
    setError("");
    void storage
      .load(storageKey)
      .then((data) => {
        if (active) setDocument(playerDocument(html, data));
      })
      .catch(() => {
        if (active) setError("Couldn’t load saved data. Try again.");
      });
    return () => {
      active = false;
    };
  }, [html, storageKey, reload]);
  return (
    <View style={{ flex: 1, minHeight: 300 }}>
      {!!error && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setReload((x) => x + 1)}
          style={{ padding: 16, backgroundColor: "#FFF0ED" }}
        >
          <Text style={{ color: "#A53A2D" }}>{error} Tap to reload.</Text>
        </Pressable>
      )}
      {!document ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : (
        <WebView
          key={reload}
          style={{ flex: 1, backgroundColor: "#F7F8FC" }}
          source={{ html: document }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          originWhitelist={["*"]}
          onShouldStartLoadWithRequest={(r) =>
            r.url === "about:blank" || r.url === "about:srcdoc"
          }
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowFileAccess={false}
          allowUniversalAccessFromFileURLs={false}
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows
          onOpenWindow={() => {}}
          onMessage={(e) => {
            const data = parseStorageMessage(e.nativeEvent.data);
            if (data)
              void storage.save(storageKey, data).catch(() => {
                if (mounted.current) setError("Couldn’t save this app’s data.");
              });
          }}
          onContentProcessDidTerminate={() => setReload((x) => x + 1)}
          onError={() => setError("Couldn’t open this app.")}
        />
      )}
    </View>
  );
}
