import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {createScreenId} from '@core/schema/ids';
import {serviceChangeNeedsConfirmation} from '@renderer/features/service/useServiceSwitchGuard';

describe('service change live guard', () => {
  const idle = emptyLiveState();
  const on = {...idle, outputs: {screen: true}};
  it('does not prompt for standby or when all screens are off', () => {
    expect(serviceChangeNeedsConfirmation(null)).toBe(false);
    expect(serviceChangeNeedsConfirmation(on)).toBe(false);
    expect(
      serviceChangeNeedsConfirmation({...idle, stageMessage: 'Live'}),
    ).toBe(false);
  });
  it.each([
    {
      ...on,
      layers: {
        ...on.layers,
        slide: {itemId: 'song', position: 0, label: null, lines: ['Lyric']},
      },
    },
    {
      ...on,
      layers: {
        ...on.layers,
        media: {mediaId: 'media', loop: false, startedAt: 0},
      },
    },
    {...on, stageMessage: 'Live message'},
    {
      ...on,
      testPatterns: [createScreenId('00000000-0000-4000-8000-000000000001')],
    },
    {...on, blackScreen: true},
  ])('prompts for live content', state =>
    expect(serviceChangeNeedsConfirmation(state)).toBe(true),
  );
});
