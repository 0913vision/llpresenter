import {describe, expect, it} from 'vitest';

/** Every file of the contracts, so a new area is checked without a list. */
const AREAS = import.meta.glob<Record<string, unknown>>(
  '/src/contracts/ipc/*.ts',
  {eager: true},
);

function channelsOf(table: object): string[] {
  return Object.values(table).flatMap((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) return [];
    const channel: unknown = Reflect.get(entry, 'channel');
    return typeof channel === 'string' ? [channel] : channelsOf(entry);
  });
}

const TABLES = Object.values(AREAS).flatMap(area =>
  Object.entries(area).flatMap(([name, value]) =>
    name.endsWith('Endpoints') && typeof value === 'object' && value !== null
      ? [value]
      : [],
  ),
);
const DECLARED = TABLES.flatMap(channelsOf);

describe('IPC endpoints', () => {
  it('find the tables of every area', () => {
    expect(TABLES.length).toBeGreaterThanOrEqual(17);
  });

  it('give every channel to exactly one endpoint', () => {
    expect(new Set(DECLARED).size).toBe(DECLARED.length);
  });

  it('name channels as area:name in lowercase words', () => {
    for (const channel of DECLARED) {
      expect(channel).toMatch(/^[a-z]+(?:-[a-z]+)*(?::[a-z]+(?:-[a-z]+)*)+$/);
    }
  });

  it('name a change as :changed, never -changed', () => {
    expect(DECLARED.filter(channel => channel.endsWith('-changed'))).toEqual(
      [],
    );
  });
});
