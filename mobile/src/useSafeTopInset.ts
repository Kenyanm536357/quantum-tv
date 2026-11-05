import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IS_TV, SAFE, vs } from "./responsive";

export function useSafeTopInset(): number {
  const { top } = useSafeAreaInsets();
  return IS_TV ? SAFE.top : Math.max(SAFE.top, top + vs(8));
}