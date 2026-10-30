import type {Screen} from '../schema/screens';

/** Stable v1 starter UUIDs, shared by new installs and their cross-file references. */
export const STARTER_SCREEN_IDS = {
  main: '00000000-0000-4000-8000-000000000001',
  broadcast: '00000000-0000-4000-8000-000000000002',
  stage: '00000000-0000-4000-8000-000000000003',
} as const;

/** Resolves configured IDs first, then M2 aliases for their original starter screen. */
export function resolveOutputScreen(
  id: string,
  screens: readonly Screen[],
): Screen | undefined {
  const exact = screens.find(screen => screen.id === id);
  if (exact !== undefined) return exact;
  const role = id === 'captions' ? 'broadcast' : id;
  if (role !== 'main' && role !== 'broadcast' && role !== 'stage') {
    return undefined;
  }
  return screens.find(screen => screen.id === STARTER_SCREEN_IDS[role]);
}

/** One logical output's canonical state key and compatible toolbar keys. */
export function outputStateKeys(id: string): readonly [string, ...string[]] {
  const role = id === 'captions' ? 'broadcast' : id;
  const match = Object.entries(STARTER_SCREEN_IDS).find(
    ([alias, uuid]) => alias === role || uuid === id,
  );
  if (match === undefined) return [id];
  const [alias, uuid] = match;
  return alias === 'broadcast' ? [uuid, alias, 'captions'] : [uuid, alias];
}
