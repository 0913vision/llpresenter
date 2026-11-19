import {sameJson} from '@core/common/sameJson';

class Conflict extends Error {}
const missing = Symbol('missing');

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function keyOf(value: unknown): string | undefined {
  if (!record(value)) return undefined;
  const id = value['id'] ?? value['name'];
  return typeof id === 'string' ? id : undefined;
}
function keyed(values: readonly unknown[]): boolean {
  const keys = values.map(keyOf);
  return (
    keys.every(key => key !== undefined) && new Set(keys).size === keys.length
  );
}
function subsetIndices(
  subset: readonly unknown[],
  sequence: readonly unknown[],
): number[] | null {
  const indices: number[] = [];
  let cursor = 0;
  for (const wanted of subset) {
    while (cursor < sequence.length && !sameJson(sequence[cursor], wanted)) {
      cursor++;
    }
    if (cursor === sequence.length) return null;
    indices.push(cursor++);
  }
  return indices;
}
function nthIndex(
  values: readonly unknown[],
  value: unknown,
  ordinal: number,
): number {
  let seen = 0;
  return values.findIndex(row => sameJson(row, value) && seen++ === ordinal);
}
function sequenceDelta(
  current: readonly unknown[],
  from: readonly unknown[],
  to: readonly unknown[],
): unknown[] {
  const matched = subsetIndices(from, to);
  if (matched) {
    const retained = new Set(matched);
    const result = [...current];
    const last = from.at(-1);
    const lastOrdinal = from.filter(value => sameJson(value, last)).length - 1;
    const lastIndex =
      from.length === 0 ? -1 : nthIndex(result, last, lastOrdinal);
    const tail =
      from.length === 0 ? 0 : lastIndex < 0 ? result.length : lastIndex + 1;
    for (let i = to.length - 1; i >= 0; i--) {
      if (retained.has(i)) continue;
      const next = matched.find(index => index > i);
      if (next === undefined) {
        result.splice(tail, 0, to[i]);
        continue;
      }
      const anchor = to[next];
      const ordinal = to
        .slice(0, next)
        .filter(
          (value, index) => retained.has(index) && sameJson(value, anchor),
        ).length;
      const at = nthIndex(result, anchor, ordinal);
      result.splice(at < 0 ? result.length : at, 0, to[i]);
    }
    return result;
  }
  const kept = subsetIndices(to, from);
  if (!kept) throw new Conflict();
  const retained = new Set(kept);
  const result = [...current];
  for (let i = from.length - 1; i >= 0; i--) {
    if (retained.has(i)) continue;
    const value = from[i];
    const ordinal = from.slice(0, i).filter(row => sameJson(row, value)).length;
    const at = nthIndex(result, value, ordinal);
    if (at < 0) throw new Conflict();
    result.splice(at, 1);
  }
  return result;
}
function keyedDelta(
  current: readonly unknown[],
  from: readonly unknown[],
  to: readonly unknown[],
): unknown[] {
  const result = [...current];
  const desiredByKey = new Map(to.map(value => [keyOf(value), value]));
  const originalKeys = new Set(from.map(keyOf));
  for (const old of from) {
    const id = keyOf(old);
    const desired = desiredByKey.get(id);
    if (desired !== undefined && sameJson(old, desired)) continue;
    const index = result.findIndex(value => keyOf(value) === id);
    if (desired === undefined) {
      if (index < 0 || !sameJson(result[index], old)) throw new Conflict();
      result.splice(index, 1);
    } else {
      if (index < 0) throw new Conflict();
      result[index] = delta(result[index], old, desired);
    }
  }
  for (let index = to.length - 1; index >= 0; index--) {
    const value = to[index];
    const id = keyOf(value);
    if (originalKeys.has(id)) continue;
    if (result.some(row => keyOf(row) === id)) throw new Conflict();
    const next = to
      .slice(index + 1)
      .find(row => result.some(currentRow => keyOf(currentRow) === keyOf(row)));
    const at =
      next === undefined
        ? result.length
        : result.findIndex(row => keyOf(row) === keyOf(next));
    result.splice(at, 0, value);
  }
  return result;
}
function delta(current: unknown, from: unknown, to: unknown): unknown {
  if (sameJson(from, to)) return current;
  if (sameJson(current, from)) return to;
  if (current === missing || from === missing || to === missing) {
    throw new Conflict();
  }
  if (Array.isArray(current) && Array.isArray(from) && Array.isArray(to)) {
    const present: readonly unknown[] = current;
    const old: readonly unknown[] = from;
    const desired: readonly unknown[] = to;
    return keyed(old) && keyed(desired) && keyed(present)
      ? keyedDelta(present, old, desired)
      : sequenceDelta(present, old, desired);
  }
  if (record(current) && record(from) && record(to)) {
    const result = {...current};
    for (const key of new Set([...Object.keys(from), ...Object.keys(to)])) {
      const old = Object.hasOwn(from, key) ? from[key] : missing;
      const desired = Object.hasOwn(to, key) ? to[key] : missing;
      const value = delta(
        Object.hasOwn(current, key) ? current[key] : missing,
        old,
        desired,
      );
      if (value === missing) Reflect.deleteProperty(result, key);
      else result[key] = value;
    }
    return result;
  }
  throw new Conflict();
}

/** Applies only the deleted fields and references, preserving unrelated later edits. */
export function applySettingsDeletionDelta(
  current: unknown,
  from: unknown,
  to: unknown,
): {ok: true; value: unknown} | {ok: false} {
  try {
    return {ok: true, value: delta(current, from, to)};
  } catch (error) {
    if (error instanceof Conflict) return {ok: false};
    throw error;
  }
}
