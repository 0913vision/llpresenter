import type * as v from 'valibot';
import {isRecord} from '../guards';

type Node = Readonly<Record<string, unknown>>;

function discriminatorMatches(schema: unknown, value: unknown): boolean {
  const node = schemaNode(schema, value);
  return node?.type === 'literal'
    ? node.literal === value
    : node?.type === 'picklist' &&
        Array.isArray(node.options) &&
        node.options.includes(value);
}

function optionMatches(option: unknown, key: unknown, value: unknown): boolean {
  const node = schemaNode(option, value);
  if (node === undefined) return false;
  if (typeof key === 'string' && isRecord(value) && isRecord(node.entries)) {
    return discriminatorMatches(node.entries[key], value[key]);
  }
  return Array.isArray(value)
    ? node.type === 'array'
    : isRecord(value) && isRecord(node.entries);
}

function schemaNode(schema: unknown, value: unknown): Node | undefined {
  if (!isRecord(schema) || schema.kind !== 'schema') return undefined;
  if (Array.isArray(schema.pipe)) {
    const steps: readonly unknown[] = schema.pipe;
    const last = steps.findLast(
      step => isRecord(step) && step.kind === 'schema',
    );
    return schemaNode(last, value);
  }
  if (schema.wrapped !== undefined) return schemaNode(schema.wrapped, value);
  if (schema.type === 'lazy' && typeof schema.getter === 'function') {
    const selected: unknown = Reflect.apply(schema.getter, undefined, [value]);
    return schemaNode(selected, value);
  }
  if (
    (schema.type === 'variant' || schema.type === 'union') &&
    Array.isArray(schema.options)
  ) {
    const options: readonly unknown[] = schema.options;
    return schemaNode(
      options.find(option => optionMatches(option, schema.key, value)),
      value,
    );
  }
  return schema;
}

function itemIdentity(
  schema: unknown,
  value: unknown,
): {readonly key: string | number; readonly stable: boolean} | undefined {
  const entries = schemaNode(schema, value)?.entries;
  if (!isRecord(value) || !isRecord(entries)) return undefined;
  if (
    Object.hasOwn(entries, 'id') &&
    (typeof value.id === 'string' || typeof value.id === 'number')
  ) {
    return {key: value.id, stable: true};
  }
  if (
    Object.hasOwn(entries, 'ref') &&
    Object.hasOwn(entries, 'translation') &&
    typeof value.ref === 'string' &&
    typeof value.translation === 'string'
  ) {
    return {key: JSON.stringify([value.translation, value.ref]), stable: true};
  }
  return Object.hasOwn(entries, 'name') && typeof value.name === 'string'
    ? {key: value.name, stable: false}
    : undefined;
}

function mergeArray(
  schema: Node,
  current: readonly unknown[],
  update: readonly unknown[],
): unknown[] {
  const byKey = new Map(
    current.flatMap(item => {
      const identity = itemIdentity(schema.item, item);
      return identity === undefined ? [] : [[identity.key, item] as const];
    }),
  );
  return update.map((item, index) => {
    const identity = itemIdentity(schema.item, item);
    const matched =
      identity === undefined ? undefined : byKey.get(identity.key);
    const previous =
      identity?.stable === true ? matched : (matched ?? current[index]);
    return merge(schema.item, previous, item);
  });
}

function merge(schema: unknown, current: unknown, update: unknown): unknown {
  const nextNode = schemaNode(schema, update);
  if (nextNode === undefined) return update;
  if (
    Array.isArray(current) &&
    Array.isArray(update) &&
    nextNode.type === 'array'
  ) {
    const previous: readonly unknown[] = current;
    const next: readonly unknown[] = update;
    return mergeArray(nextNode, previous, next);
  }
  if (!isRecord(current) || !isRecord(update)) return update;
  if (nextNode.type === 'record') {
    return Object.fromEntries(
      Object.entries(update).map(([key, value]) => [
        key,
        merge(nextNode.value, current[key], value),
      ]),
    );
  }
  if (!isRecord(nextNode.entries)) return update;
  const nextEntries = nextNode.entries;
  const oldNode = schemaNode(schema, current);
  const oldEntries = isRecord(oldNode?.entries) ? oldNode.entries : {};
  const kept = Object.entries(current).filter(
    ([key]) =>
      !Object.hasOwn(nextEntries, key) && !Object.hasOwn(oldEntries, key),
  );
  const changed = Object.entries(update).map(([key, value]) => [
    key,
    merge(nextEntries[key], current[key], value),
  ]);
  return Object.fromEntries([...kept, ...changed]);
}

/** Preserves unknown fields on retained objects; omitted known fields and deleted items stay removed. */
export function preserveUnknownFields(
  schema: v.GenericSchema,
  current: unknown,
  update: unknown,
): unknown {
  return merge(schema, current, update);
}
