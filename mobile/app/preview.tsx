import React from "react";
import { ScrollView, View, Text, StyleSheet, Pressable } from "react-native";
import ImageWithFallback from "../src/ImageWithFallback";
import hairline from "../src/hairline";
import { s, vs, ms, SAFE } from "../src/responsive";

export default function Preview() {
  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text style={styles.title}>Visual Preview</Text>

      <View style={styles.row}>
        <View style={[styles.card, hairline()]}> 
          <Text style={styles.cardTitle}>Logo</Text>
          <ImageWithFallback source={require("../assets/logo.png")} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={[styles.card, hairline()]}> 
          <Text style={styles.cardTitle}>Hairline Border</Text>
          <View style={[styles.hairlineBox, hairline("all")]} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sample Focused Card</Text>
        <Pressable style={({ pressed }) => [styles.focusCard, pressed && styles.focusPressed]}>
          <ImageWithFallback source={require("../assets/logo.png")} style={styles.focusImage} />
          <Text style={styles.focusText}>Focus state preview</Text>
        </Pressable>
      </View>

      <View style={{ height: SAFE.bottom + 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    padding: s(18),
    backgroundColor: "#060714",
    minHeight: "100%",
  },
  title: {
    color: "#E6E7EB",
    fontSize: ms(22),
    marginBottom: vs(12),
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    gap: s(12),
  },
  card: {
    flex: 1,
    padding: s(12),
    backgroundColor: "#0B0518",
    borderRadius: s(8),
  },
  cardTitle: {
    color: "#9CA3AF",
    marginBottom: vs(8),
    fontSize: ms(12),
  },
  logo: {
    width: "100%",
    height: vs(80),
    alignSelf: "center",
  },
  hairlineBox: {
    height: vs(48),
    backgroundColor: "#00000000",
    marginTop: vs(8),
  },
  section: {
    marginTop: vs(18),
  },
  sectionTitle: {
    color: "#E6E7EB",
    marginBottom: vs(8),
    fontSize: ms(16),
  },
  focusCard: {
    backgroundColor: "#111018",
    padding: s(12),
    borderRadius: s(10),
    alignItems: "center",
  },
  focusPressed: {
    transform: [{ scale: 0.995 }],
  },
  focusImage: {
    width: s(120),
    height: vs(120),
    marginBottom: vs(8),
  },
  focusText: {
    color: "#DFE7EA",
    fontSize: ms(14),
  },
});
