import {describe, expect, it} from 'vitest';
import {parseScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';

describe('STARTER_SCREEN_IDS', () => {
  it('names three distinct screen ids', () => {
    const ids = Object.values(STARTER_SCREEN_IDS);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(parseScreenId(id).ok).toBe(true);
  });
});
