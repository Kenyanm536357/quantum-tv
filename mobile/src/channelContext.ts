// Ordered channels of the list the user opened a channel from, so the
// player can surf up/down through the same list.
type Entry = { key: string; title: string };
let entries: Entry[] = [];

export const setChannelContext = (next: Entry[]) => { entries = next; };

export const getAdjacentChannel = (current: string, dir: 1 | -1): Entry | null => {
  const i = entries.findIndex((e) => e.key === current);
  if (i < 0 || entries.length < 2) return null;
  return entries[(i + dir + entries.length) % entries.length];
};
