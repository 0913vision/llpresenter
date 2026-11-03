import {describe, expect, it} from 'vitest';
import {
  rebaseNotice,
  noticeStopDelay,
  noticePosition,
  nextNoticeChange,
  MAX_OVERLAY_TIMER_MS,
} from '@core/overlays/noticeClock';
import type {NoticePlayback} from '@core/live/state';
import {parseNoticePlayback} from '@core/schema/overlayState';
import {createMediaId} from '@core/schema/ids';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

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

  it('keeps a gone image on screen until its interval ends, then skips it', () => {
    const second = createMediaId('00000000-0000-4000-8000-000000000002');
    const state = playback({loop: true, position: 1, gone: [second]});
    for (const [offset, position] of [
      [0, 1],
      [4999, 1],
      [5000, 2],
      [10000, 0],
      [15000, 2],
      [20000, 0],
    ] as const) {
      expect(noticePosition(state, START + offset)).toBe(position);
    }
    expect(nextNoticeChange(state, START + 1000)).toBe(4000);
  });

  it('skips gone images without looping and stops at the last one left', () => {
    const second = createMediaId('00000000-0000-4000-8000-000000000002');
    const third = createMediaId('00000000-0000-4000-8000-000000000003');
    const skipping = playback({gone: [second]});
    expect(noticePosition(skipping, START + 5000)).toBe(2);
    expect(nextNoticeChange(skipping, START + 5000)).toBeNull();
    const trailing = playback({gone: [third]});
    expect(noticePosition(trailing, START + 5000)).toBe(1);
    expect(nextNoticeChange(trailing, START + 5000)).toBeNull();
  });

  it('needs no timer when every other image is gone', () => {
    const [first, second, third] = [1, 2, 3].map(number =>
      createMediaId(`00000000-0000-4000-8000-00000000000${number}`),
    );
    if (second === undefined || third === undefined || first === undefined) {
      throw new Error('Missing ids');
    }
    const state = playback({loop: true, gone: [second, third]});
    expect(noticePosition(state, START + 50_000)).toBe(0);
    expect(nextNoticeChange(state, START)).toBeNull();
    const all = playback({loop: true, gone: [first, second, third]});
    expect(noticePosition(all, START + 50_000)).toBe(0);
    expect(nextNoticeChange(all, START)).toBeNull();
  });

  it('ends a 공지 whose every image is gone at the end of the interval on screen', () => {
    const [first, second, third] = [1, 2, 3].map(number =>
      createMediaId(`00000000-0000-4000-8000-00000000000${number}`),
    );
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Missing ids');
    }
    const ended = playback({
      loop: true,
      position: 1,
      gone: [first, second, third],
    });
    expect(noticePosition(ended, START + 50_000)).toBe(1);
    expect(noticeStopDelay(ended, START)).toBe(5000);
    expect(noticeStopDelay(ended, START + 1200)).toBe(3800);
    expect(noticeStopDelay(ended, START + 7000)).toBe(3000);
    expect(
      noticeStopDelay({...ended, pausedAt: START + 2000}, START + 9000),
    ).toBe(null);
    expect(
      noticeStopDelay(playback({gone: [first, second]}), START),
    ).toBeNull();
    expect(noticeStopDelay(playback(), START)).toBeNull();
  });

  it('rebases a run to the image on screen without moving the next change', () => {
    const state = playback({loop: true, position: 1});
    for (const offset of [0, 3000, 5000, 12_300, 29_999]) {
      const now = START + offset;
      const rebased = rebaseNotice(state, now);
      const after = {...state, ...rebased};
      expect(noticePosition(after, now)).toBe(noticePosition(state, now));
      expect(after.position).toBe(noticePosition(state, now));
      expect(nextNoticeChange(after, now)).toBe(nextNoticeChange(state, now));
      expect(noticePosition(after, now + 7000)).toBe(
        noticePosition(state, now + 7000),
      );
    }
  });

  it('rebases a paused run at its pause, and a non-loop run at its last image', () => {
    const paused = playback({pausedAt: START + 7000});
    const rebased = rebaseNotice(paused, START + 60_000);
    expect(rebased.position).toBe(1);
    expect(START + 7000 - rebased.startedAt).toBe(2000);
    const last = playback();
    const atEnd = rebaseNotice(last, START + 100_000);
    expect(atEnd.position).toBe(2);
    expect(nextNoticeChange({...last, ...atEnd}, START + 100_000)).toBeNull();
  });
});
