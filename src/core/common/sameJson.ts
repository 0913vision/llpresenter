/** Whether two JSON values hold the same data, whatever their key order. */
export function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  ) {
    return false;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJson(value, right[index]))
    );
  }
  const rightEntries = new Map(Object.entries(right));
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === rightEntries.size &&
    leftEntries.every(
      ([key, value]) =>
        rightEntries.has(key) && sameJson(value, rightEntries.get(key)),
    )
  );
}
