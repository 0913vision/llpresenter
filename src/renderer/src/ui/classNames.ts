/** Joins the class names that are set, skipping `false` and `undefined`. */
export function classNames(
  ...names: ReadonlyArray<string | false | undefined>
): string {
  return names
    .filter(name => typeof name === 'string' && name !== '')
    .join(' ');
}
