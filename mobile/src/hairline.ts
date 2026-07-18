import { PixelRatio, StyleSheet } from "react-native";

// React Native exposes StyleSheet.hairlineWidth but be defensive and
// compute a fallback for extremely old RN versions or platforms.
export const hairlineWidth = StyleSheet.hairlineWidth || 1 / PixelRatio.get();

export const hairline = (side: "all" | "top" | "bottom" | "left" | "right" = "all") => {
  const w = hairlineWidth;
  switch (side) {
    case "top":
      return { borderTopWidth: w };
    case "bottom":
      return { borderBottomWidth: w };
    case "left":
      return { borderLeftWidth: w };
    case "right":
      return { borderRightWidth: w };
    case "all":
    default:
      return { borderWidth: w };
  }
};

export default hairline;
