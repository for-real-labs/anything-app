import { Pressable, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../theme";
export function Button({
  label,
  onPress,
  quiet = false,
  disabled = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        quiet && s.quiet,
        disabled && s.disabled,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={[s.label, quiet && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}
const s = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 18,
    minHeight: 56,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  quiet: {
    backgroundColor: "transparent",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  disabled: { opacity: 0.45 },
  label: { fontFamily: fonts.medium, fontSize: 17, color: colors.paper },
});
