import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, GRADIENTS } from "./api";

/**
 * Screen-wide branded background used on all main tabs. Layers:
 *   1. Solid deep-purple base (colors.bg — matches login)
 *   2. Diagonal royal-purple wash (subtle, whole screen)
 *   3. Radial-style header glow (top ~55% of screen) — mirrors the
 *      LinearGradient used on /login so the app feels consistent.
 *
 * Children render on top of all three layers. `style` targets the outer
 * View if a screen needs to override safe-area padding, etc.
 */
export function BrandBackground({
  children,
  style,
  headerGlow = true,
}: React.PropsWithChildren<{
  style?: ViewStyle | ViewStyle[];
  headerGlow?: boolean;
}>) {
  return (
    <View style={[styles.root, style]}>
      {/* Layer 1: solid base is already set on styles.root (colors.bg) */}
      {/* Layer 2: diagonal royal-purple wash */}
      <LinearGradient
        colors={GRADIENTS.screenBg}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Layer 3: header glow (top-anchored) */}
      {headerGlow ? (
        <LinearGradient
          colors={GRADIENTS.headerGlow}
          start={{ x: 0.4, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={styles.headerGlow}
          pointerEvents="none"
        />
      ) : null}
      {/* Actual screen content */}
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "55%",
  },
});

export default BrandBackground;
