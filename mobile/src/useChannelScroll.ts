import { useCallback, useRef, useState } from "react";
import { useTVEventHandler } from "react-native";

// Remote channel up/down (and fast-forward/rewind on Fire TV remotes that lack
// channel keys) jump the list by a page and move D-pad focus to the new item.
export function useChannelScroll(opts: {
  enabled: boolean;
  count: number;
  step: number;
  scrollToIndex: (index: number) => void;
}) {
  const { enabled, count, step, scrollToIndex } = opts;
  const focusedIdx = useRef(0);
  const [preferIndex, setPreferIndex] = useState(0);

  const onItemFocus = useCallback((index: number) => { focusedIdx.current = index; }, []);

  useTVEventHandler((evt: any) => {
    if (!enabled || !count || !evt || evt.eventType === undefined) return;
    if (evt.eventKeyAction === 0) return; // act once, on key-up
    const t = evt.eventType;
    let dir = 0;
    if (t === "channelDown" || t === "fastForward") dir = 1;
    else if (t === "channelUp" || t === "rewind") dir = -1;
    if (!dir) return;
    const target = Math.max(0, Math.min(count - 1, focusedIdx.current + dir * step));
    if (target === focusedIdx.current) return;
    scrollToIndex(target);
    focusedIdx.current = target;
    setTimeout(() => setPreferIndex(target), 80);
  });

  return { preferIndex, onItemFocus };
}
