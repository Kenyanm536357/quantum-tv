import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "./api";
import { IS_TV, ms, s, vs } from "./responsive";

export default function StartupScreen() {
  const [visible, setVisible] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0.82)).current;

  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.82, duration: 1400, useNativeDriver: true }),
      ]),
    );
    pulseAnimation.start();

    const fadeTimer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setVisible(false);
      });
    }, 2200);

    return () => {
      pulseAnimation.stop();
      clearTimeout(fadeTimer);
    };
  }, [opacity, pulse]);

  if (!visible) return null;

  return (
    <Animated.View pointerEvents="none" style={[styles.wrap, { opacity }]}>
      <Animated.View style={[styles.glow, { opacity: pulse, transform: [{ scale: pulse }] }]} />
      <View style={styles.wordmark}>
        <View style={styles.brandMark}>
          <Ionicons name="play" size={ms(22)} color="#050614" />
        </View>
        <Text style={styles.brandName}>QUANTUM TV</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.iconDot}>
          <Ionicons name="sparkles" size={ms(40)} color="#050614" />
        </View>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.body}>Loading your Quantum TV experience…</Text>
        {IS_TV ? <Text style={styles.tvHint}>Optimized for your Android TV</Text> : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    backgroundColor: "rgba(5,6,20,0.94)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glow: {
    position: "absolute",
    width: ms(720),
    height: ms(720),
    borderRadius: 999,
    backgroundColor: colors.cyan,
    opacity: 0.18,
  },
  wordmark: {
    position: "absolute",
    top: vs(38),
    flexDirection: "row",
    alignItems: "center",
    gap: s(10),
  },
  brandMark: {
    width: ms(40),
    height: ms(40),
    borderRadius: 12,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    color: "#fff",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(19),
    letterSpacing: 1.5,
  },
  card: {
    alignItems: "center",
    width: "88%",
    maxWidth: s(720),
    paddingHorizontal: s(26),
    paddingVertical: vs(30),
    borderRadius: 28,
    backgroundColor: "rgba(6,7,20,0.94)",
    borderWidth: 2,
    borderColor: colors.cyan,
    overflow: "hidden",
    shadowColor: colors.cyan,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  iconDot: {
    width: ms(86),
    height: ms(86),
    borderRadius: 999,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: vs(16),
  },
  title: {
    color: "#fff",
    fontFamily: "Unbounded_700Bold",
    fontSize: ms(IS_TV ? 24 : 21),
    textAlign: "center",
    marginBottom: vs(8),
  },
  body: {
    color: colors.zinc300,
    fontFamily: "Outfit_500Medium",
    fontSize: ms(IS_TV ? 15 : 14),
    textAlign: "center",
    lineHeight: ms(IS_TV ? 24 : 22),
  },
  tvHint: {
    marginTop: vs(16),
    color: colors.zinc400,
    fontFamily: "Outfit_600SemiBold",
    fontSize: ms(13),
    letterSpacing: 0.4,
    textAlign: "center",
  },
});
