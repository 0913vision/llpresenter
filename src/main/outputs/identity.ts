import {STARTER_SCREEN_IDS} from '@shared/screens';

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
