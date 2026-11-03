import {copyName} from './copyName';

/** What a copy of a named list entry needs to know about its list. */
export interface DuplicateRules {
  /** The most entries the list holds; a copy that would pass it is refused. */
  readonly limit: number;
  /** The longest name the owner allows. */
  readonly maxName?: number | undefined;
}

/**
 * The list with a copy of one entry right after it: the same fields, a new id,
 * and the copy name (`<name> 복사본`, then `<name> 복사본 2`). A copy whose id
 * is already in the list leaves it as it is, so a repeated write adds nothing.
 *
 * @throws When the original is gone or the list is full.
 */
export function duplicateAfter<
  T extends {readonly id: string; readonly name: string},
>(
  list: readonly T[],
  {id, copyId}: {readonly id: string; readonly copyId: T['id']},
  {limit, maxName}: DuplicateRules,
): readonly T[] {
  if (list.some(item => item.id === copyId)) return list;
  const index = list.findIndex(item => item.id === id);
  const source = list[index];
  if (source === undefined) throw new Error('The original no longer exists');
  if (list.length >= limit) throw new Error('The list is full');
  const name = copyName(
    source.name,
    list.map(item => item.name),
    {maxLength: maxName},
  );
  return [
    ...list.slice(0, index + 1),
    {...source, id: copyId, name},
    ...list.slice(index + 1),
  ];
}
