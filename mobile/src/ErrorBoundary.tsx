import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./api";
import { SIZES, SAFE, vs, ms } from "./responsive";

/**
 * Screen-level error boundary. On Fire TV, an unhandled JS error was
 * previously crashing the whole app; wrapping each tab route in this
 * shows an inline "something went wrong" screen with a Retry button so
 * the user can dismiss without losing app state.
 */
type Props = React.PropsWithChildren<{ label?: string }>;
type State = { err: Error | null };
export class ErrorBoundary extends React.Component<Props, State> {
  state: State;
  constructor(props: Props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err: Error): State { return { err }; }
  componentDidCatch(err: Error, info: any) {
    // eslint-disable-next-line no-console
    console.warn("[ErrorBoundary]", this.props.label, err?.message, info?.componentStack);
  }
  reset = () => this.setState({ err: null });
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <View style={styles.root}>
        <Ionicons name="alert-circle-outline" size={ms(44)} color="#fca5a5" />
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.msg} numberOfLines={3}>
          {this.state.err.message || "Unexpected error"}
        </Text>
        <Pressable
          testID="error-retry"
          focusable
          hasTVPreferredFocus
          onPress={this.reset}
          style={({ focused }) => [styles.retry, focused && { borderColor: colors.cyan }]}
        >
          <Ionicons name="refresh" size={ms(18)} color="#fff" />
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, backgroundColor: colors.bg, paddingTop: SAFE.top + vs(20) },
  title: { color: "#fff", fontFamily: "Unbounded_800ExtraBold", fontSize: SIZES.fontH1, marginTop: 12, textAlign: "center" },
  msg: { color: colors.zinc400, fontFamily: "Outfit_400Regular", fontSize: SIZES.fontSmall, marginTop: 8, textAlign: "center", maxWidth: 480 },
  retry: {
    marginTop: 22, flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 999, borderWidth: 2, borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(139,92,246,0.20)",
  },
  retryText: { color: "#fff", fontFamily: "Unbounded_700Bold", fontSize: SIZES.fontSmall },
});

export default ErrorBoundary;
