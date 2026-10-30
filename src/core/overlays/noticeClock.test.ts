import {describe, expect, it} from 'vitest';
import {
  noticePosition,
  nextNoticeChange,
  MAX_OVERLAY_TIMER_MS,
} from './noticeClock';
import type {NoticePlayback} from '../live/state';
import {parseNoticePlayback} from '../schema/overlayState';
import {createMediaId} from '../schema/ids';
import {expectSuccess} from '../schema/testHelpers';

const START = 1_700_000_000_000;
const ID = '00000000-0000-4000-8000-000000000001';
function playback(change: Partial<NoticePlayback> = {}): NoticePlayback {
  return expectSuccess(
    parseNoticePlayback({
      media: [
        ID,
        '00000000-0000-4000-8000-000000000002',
        '00000000-0000-4000-8000-000000000003',
      ],
      position: 0,
      interval: 5,
      loop: false,
      targets: [ID],
      startedAt: START,
      pausedAt: null,
      ...change,
    }),
  );
}

describe('shared notice clock', () => {
  it('advances exactly on boundaries and stops at the final image without looping', () => {
    const state = playback();
    for (const [offset, position, delay] of [
      [0, 0, 5000],
      [4999, 0, 1],
      [5000, 1, 5000],
      [9999, 1, 1],
      [10000, 2, null],
      [100000, 2, null],
    ] as const) {
      expect(noticePosition(state, START + offset)).toBe(position);
      expect(nextNoticeChange(state, START + offset)).toBe(delay);
    }
  });

  it('loops from the chosen start position and keeps its interval phase', () => {
    const state = playback({loop: true, position: 1});
    expect(noticePosition(state, START + 12_000)).toBe(0);
    expect(nextNoticeChange(state, START + 12_000)).toBe(3000);
    expect(noticePosition(state, START + 15_000)).toBe(1);
    expect(nextNoticeChange(state, START + 15_000)).toBe(5000);
  });

  it('freezes paused playback and resumes the remaining interval when its start clock shifts', () => {
    const paused = playback({pausedAt: START + 7000});
    expect(noticePosition(paused, START + 67_000)).toBe(1);
    expect(nextNoticeChange(paused, START + 67_000)).toBeNull();
    const resumed = playback({startedAt: START + 60_000});
    expect(noticePosition(resumed, START + 67_000)).toBe(1);
    expect(nextNoticeChange(resumed, START + 67_000)).toBe(3000);
    expect(noticePosition(resumed, START + 70_000)).toBe(2);
  });

  it('clamps a backward clock to the start and uses a minimum millisecond interval', () => {
    const state = playback({position: 1});
    expect(noticePosition(state, START - 1000)).toBe(1);
    expect(nextNoticeChange(state, START - 1000)).toBe(5000);
    const fast = playback({interval: 0.0001});
    expect(noticePosition(fast, START + 1)).toBe(1);
    expect(nextNoticeChange(fast, START)).toBe(1);
  });

  it('needs no timer for one image, with or without looping', () => {
    for (const loop of [false, true]) {
      const state = playback({media: [createMediaId(ID)], loop});
      expect(noticePosition(state, START + 100_000)).toBe(0);
      expect(nextNoticeChange(state, START)).toBeNull();
    }
  });

  it('exports the timer limit while preserving longer notice intervals for callers to clamp', () => {
    const state = playback({interval: (MAX_OVERLAY_TIMER_MS + 1) / 1000});
    expect(MAX_OVERLAY_TIMER_MS).toBe(2_147_483_647);
    expect(nextNoticeChange(state, START)).toBe(MAX_OVERLAY_TIMER_MS + 1);
  });
});
