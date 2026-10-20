/** Use a URL filter (?period=today) only if it is one of the known values, so dashboard links land on the right view. */
export const pickParam = (value: string | null, allowed: string[], fallback: string) =>
  value && allowed.includes(value) ? value : fallback;
