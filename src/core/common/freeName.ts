/**
 * `base` when no name in `taken` is the same, else the first numbered form of
 * it from 2 on that is free: `base 2`, `base 3`, and so on, or the form
 * `numbered` writes.
 */
export function freeName(
  base: string,
  taken: ReadonlySet<string>,
  numbered: (number: number) => string = number => `${base} ${number}`,
): string {
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(numbered(number))) number++;
  return numbered(number);
}
