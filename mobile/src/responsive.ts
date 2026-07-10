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
export const SCREEN_W = win.width;
export const SCREEN_H = win.height;

// Detect a TV-like environment: Android TV / Fire TV / tvOS / very wide aspect.
// Platform.isTV is `true` on the react-native-tvos fork when running on a TV.
export const IS_TV =
  (Platform as any).isTV === true ||
  Platform.OS === "android" && SCREEN_W >= 960 && SCREEN_W / SCREEN_H > 1.4;

// Horizontal scaling: stretches to the screen width
export const s = (size: number): number => {
  const base = IS_TV ? TV_BASE_W : BASE_W;
  return Math.round((SCREEN_W / base) * size);
};

// Vertical scaling
export const vs = (size: number): number => {
  const base = IS_TV ? 720 : BASE_H;
  return Math.round((SCREEN_H / base) * size);
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
const safePct = IS_TV ? 0.055 : 0.02;
export const SAFE = {
  top: Math.round(SCREEN_H * safePct),
  bottom: Math.round(SCREEN_H * safePct),
  left: Math.round(SCREEN_W * safePct) + SIDE_RAIL_W,
  right: Math.round(SCREEN_W * safePct),
};

// Card grid columns based on screen width
export const GRID_COLS = {
  posters: IS_TV ? (SCREEN_W >= 1600 ? 7 : SCREEN_W >= 1200 ? 6 : 5) : 3,
  channels: IS_TV ? (SCREEN_W >= 1600 ? 5 : 4) : 2,
};

// Standard sizes used everywhere
export const SIZES = {
  fontTitle: ms(28),
  fontH1: ms(22),
  fontH2: ms(18),
  fontBody: ms(14),
  fontSmall: ms(11),
  fontTiny: ms(9),

  radius: s(14),
  radiusSm: s(10),
  radiusLg: s(20),

  gap: s(12),
  gapLg: s(20),

  // Touch targets
  btnH: vs(IS_TV ? 56 : 48),
  cardW: IS_TV ? s(180) : s(140),
  cardH: IS_TV ? vs(270) : vs(210),

  tabBarH: IS_TV ? vs(78) : vs(62),
  iconSm: ms(16),
  iconMd: ms(22),
  iconLg: ms(32),
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
