// A group of words as a shared part looks them up (`labels.states[state]`):
// every key the group has (its messages, from useMessages), each with its
// words from `word` (the translator, so fields and quotes read right).
export function wordGroup<K extends string>(
  group: Record<K, string>,
  word: (key: K) => string
): Record<K, string> {
  const keys = Object.keys(group) as K[]
  return Object.fromEntries(keys.map((key) => [key, word(key)])) as Record<K, string>
}
