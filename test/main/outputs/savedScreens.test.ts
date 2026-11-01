import {describe, expect, it} from 'vitest';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {savedScreens, switchableScreens} from '@main/outputs/savedScreens';

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function readerOf(screens: readonly object[]) {
  const document = settingsDocument('screens', {screens});
  return {get: () => document};
}

describe('switchableScreens', () => {
  it('leaves out NDI screens', () => {
    const reader = readerOf([
      {id: uuid(1), name: 'Main', kind: 'audience', method: 'fullscreen'},
      {id: uuid(2), name: 'Captions', kind: 'audience', method: 'capture'},
      {id: uuid(3), name: 'Stage', kind: 'stage', method: 'window'},
      {id: uuid(4), name: 'Stream', kind: 'audience', method: 'ndi'},
    ]);

    expect(switchableScreens(reader).map(({id}) => id)).toEqual([
      uuid(1),
      uuid(2),
      uuid(3),
    ]);
  });

  it('keeps no more screens than the live state can switch', () => {
    const reader = readerOf(
      Array.from({length: LIVE_STATE_LIMITS.outputs + 1}, (_, n) => ({
        id: uuid(n + 1),
        name: `Screen ${n}`,
        kind: 'audience',
        method: 'window',
      })),
    );

    expect(switchableScreens(reader)).toHaveLength(LIVE_STATE_LIMITS.outputs);
  });
});

describe('savedScreens', () => {
  it('reads no screens from another settings document', () => {
    const labels = settingsDocument('labels', {labels: []});

    expect(savedScreens({get: () => labels})).toEqual([]);
  });
});
