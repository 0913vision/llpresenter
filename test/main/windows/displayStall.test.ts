import {beforeEach, describe, expect, it, vi} from 'vitest';

const listeners = vi.hoisted(() => new Map<string, () => void>());
vi.mock('electron', () => ({
  screen: {
    on: (event: string, listener: () => void) => listeners.set(event, listener),
    removeListener: (event: string) => listeners.delete(event),
  },
}));

const {DISPLAY_SETTLE_MS, stallNeedsRecovery, watchDisplayChanges} =
  await import('@main/windows/displayStall');

describe('stallNeedsRecovery', () => {
  it('recovers a window whose script does not answer, display change or not', () => {
    expect(
      stallNeedsRecovery({
        scriptAnswered: false,
        lastDisplayChange: 1000,
        now: 2000,
      }),
    ).toBe(true);
  });

  it('waits for a window that only draws nothing right after the displays changed', () => {
    expect(
      stallNeedsRecovery({
        scriptAnswered: true,
        lastDisplayChange: 1000,
        now: 1000 + DISPLAY_SETTLE_MS,
      }),
    ).toBe(false);
  });

  it('recovers a window that draws nothing long after the displays changed, or with no change', () => {
    expect(
      stallNeedsRecovery({
        scriptAnswered: true,
        lastDisplayChange: 1000,
        now: 1001 + DISPLAY_SETTLE_MS,
      }),
    ).toBe(true);
    expect(
      stallNeedsRecovery({
        scriptAnswered: true,
        lastDisplayChange: null,
        now: 5,
      }),
    ).toBe(true);
  });
});

describe('watchDisplayChanges', () => {
  beforeEach(() => listeners.clear());

  it('notes every kind of display change, and stops listening', () => {
    let time = 10;
    const watch = watchDisplayChanges(() => time);
    expect(watch.last()).toBeNull();
    for (const event of [
      'display-added',
      'display-removed',
      'display-metrics-changed',
    ]) {
      time += 5;
      listeners.get(event)?.();
      expect(watch.last()).toBe(time);
    }
    watch.stop();
    expect(listeners.size).toBe(0);
  });
});
