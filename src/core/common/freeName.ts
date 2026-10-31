export function freeName(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(`${base} ${number}`)) number++;
  return `${base} ${number}`;
}
