/**
 * The row the cursor goes to after rows were deleted: the first one left
 * after them, or else the last one left before them.
 */
export function rowAfterDeletion(
  before: ReadonlyArray<{readonly id: string}>,
  deleted: readonly string[],
  after: ReadonlyArray<{readonly id: string}>,
): string | undefined {
  const index = before.findIndex(row => deleted.includes(row.id));
  if (index < 0) return undefined;
  const left = new Set(after.map(row => row.id));
  return (
    before.slice(index).find(row => left.has(row.id))?.id ??
    before
      .slice(0, index)
      .reverse()
      .find(row => left.has(row.id))?.id
  );
}
