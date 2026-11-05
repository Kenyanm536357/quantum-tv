/**
 * Responsive scaling + TV overscan safety.
 *
 * Most TVs over-scan (clip) ~3-5% of every edge of the displayed image, so
 * anything pushed to the edge of the screen visually disappears on real
 * hardware. Combined with the fact that the app may render on anything from a
 * 480x720 Fire TV Stick Lite to a 3840x2160 Fire TV Omni 4K, we need
 * everything sized RELATIVE to the screen, not in fixed pixels.
 *
 * Usage:
 *   import { s, vs, ms, SAFE } from "./responsive";
 *   fontSize: ms(14)         // moderately scaled, looks the same across TVs
 *   width: s(120)            // width-scaled
 *   paddingTop: SAFE.top     // safe top margin for TV overscan
 */
import { Dimensions, PixelRatio, Platform } from "react-native";

const BASE_W = 390;   // iPhone reference width (where original mocks were drawn)
const BASE_H = 844;   // iPhone reference height
const TV_BASE_W = 1280; // 720p TV reference width (we lerp toward this on TV)

const win = Dimensions.get("window");
export let SCREEN_W = win.width;
export let SCREEN_H = win.height;

// Keep scaling helpers current when a phone rotates or the app moves between
// windows (split-screen/tablet). Screens using useWindowDimensions rerender on
// the same event and pick up these latest measurements.
Dimensions.addEventListener("change", ({ window }) => {
  SCREEN_W = window.width;
  SCREEN_H = window.height;
});

// Detect a TV-like environment: Android TV / Fire TV / tvOS / very wide aspect.
// Platform.isTV is `true` on the react-native-tvos fork when running on a TV.
export const IS_TV =
  (Platform as any).isTV === true ||
  Platform.OS === "android" && SCREEN_W >= 960 && SCREEN_W / SCREEN_H > 1.4;

// Horizontal scaling: stretches to the screen width
export const s = (size: number): number => {
  const base = IS_TV ? TV_BASE_W : BASE_W;
  const rawScale = SCREEN_W / base;
  const scale = IS_TV ? rawScale : Math.max(0.82, Math.min(rawScale, 1.12));
  return Math.round(scale * size);
};

// Vertical scaling
export const vs = (size: number): number => {
  const base = IS_TV ? 720 : BASE_H;
  const rawScale = SCREEN_H / base;
  const scale = IS_TV ? rawScale : Math.max(0.78, Math.min(rawScale, 1.12));
  return Math.round(scale * size);
};

// Moderate scaling — better for fonts (avoids over-scaling on huge screens)
export const ms = (size: number, factor = 0.5): number => {
  return Math.round(size + (s(size) - size) * factor);
};

// TV-safe insets: ~5% of each edge to avoid overscan + bezels.
// Phones: keep small margins; TVs: use generous safe area.
// On TV, the left inset accounts for the COLLAPSED (icon-only) nav rail
// width. The expanded rail overlays content Netflix-style.
export const SIDE_RAIL_W = IS_TV ? 68 : 0; // collapsed icon-only width
export const SIDE_RAIL_EXPANDED_W = 230;
export const SAFE = {
  get top() { return Math.round(SCREEN_H * (IS_TV ? 0.055 : 0.02)); },
  get bottom() { return Math.round(SCREEN_H * (IS_TV ? 0.055 : 0.02)); },
  get left() { return Math.round(SCREEN_W * (IS_TV ? 0.055 : 0.02)) + SIDE_RAIL_W; },
  get right() { return Math.round(SCREEN_W * (IS_TV ? 0.055 : 0.02)); },
};

// Card grid columns based on screen width
export const GRID_COLS = {
  get posters() {
    return IS_TV
      ? (SCREEN_W >= 1600 ? 7 : SCREEN_W >= 1200 ? 6 : 5)
      : Math.max(2, Math.min(5, Math.floor((SCREEN_W - 32) / 112)));
  },
  get channels() { return IS_TV ? (SCREEN_W >= 1600 ? 5 : 4) : (SCREEN_W < 360 ? 1 : 2); },
};

// Standard sizes used everywhere
export const SIZES = {
  // Slight TV-specific upscale for readability on large screens
  get fontTitle() { return ms(28) * (IS_TV ? 1.12 : 1); },
  get fontH1() { return ms(22) * (IS_TV ? 1.12 : 1); },
  get fontH2() { return ms(18) * (IS_TV ? 1.12 : 1); },
  get fontBody() { return ms(14) * (IS_TV ? 1.12 : 1); },
  get fontSmall() { return ms(11) * (IS_TV ? 1.12 : 1); },
  get fontTiny() { return ms(9) * (IS_TV ? 1.12 : 1); },

  get radius() { return s(14); },
  get radiusSm() { return s(10); },
  get radiusLg() { return s(20); },

  get gap() { return s(12); },
  get gapLg() { return s(20); },

  // Touch targets
  get btnH() { return vs(IS_TV ? 56 : 48); },
  get cardW() { return IS_TV ? s(180) : s(140); },
  get cardH() { return IS_TV ? vs(270) : vs(210); },

  get tabBarH() { return IS_TV ? vs(78) : vs(62); },
  get iconSm() { return ms(16); },
  get iconMd() { return ms(22); },
  get iconLg() { return ms(32); },
};

// Convenience focus-ring style (for D-pad navigation on TV)
export const FOCUS_RING = {
  borderWidth: 3,
  borderColor: "#06B6D4",
  shadowColor: "#06B6D4",
  shadowOpacity: 0.6,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 0 },
  transform: [{ scale: 1.06 }],
};

// Cyan glow overlay applied to focused cards (Fire TV D-pad hover).
// NOTE: No `transform: scale` — the size change was showing up as "weird
// movement" on older TVs. Border + shadow alone gives more than enough
// visual signal that a card is focused, without the layout wiggle.
export const FOCUSED_CARD = {
  borderWidth: 3,
  borderColor: "#06B6D4",
  shadowColor: "#06B6D4",
  shadowOpacity: 0.9,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 0 },
  elevation: 12,
};
