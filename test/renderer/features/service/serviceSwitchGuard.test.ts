import {describe, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
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
});
