import {act, renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import type {PlaybackProblems} from '@core/schema/playbackProblems';
import {usePlaybackNotices} from '@renderer/app/notifications/usePlaybackNotices';
import {useOutputWarnings} from '@renderer/platform/outputWarnings';
import type {Notice} from '@renderer/ui/notices';

beforeEach(() => useOutputWarnings.setState({warnings: new Map()}));

function setup(initial: Promise<PlaybackProblems> = Promise.resolve([])) {
  let receive: (problems: PlaybackProblems) => void = () => undefined;
  const retryPlayback = vi.fn();
  const unsubscribe = vi.fn();
  const api = mockLlpApi({
    output: {
      getPlaybackProblems: () => initial,
      subscribePlaybackProblems: listener => {
        receive = listener;
        return unsubscribe;
      },
      retryPlayback,
    },
  });
  const target = {
    report: vi.fn<(notice: Notice) => void>(),
    dismiss: vi.fn(),
    getNotices: () => [],
  };
  const hook = renderHook(() => usePlaybackNotices(api, target));
  return {
    ...hook,
    target,
    retryPlayback,
    unsubscribe,
    push: (problems: PlaybackProblems) => act(() => receive(problems)),
  };
}

describe('usePlaybackNotices', () => {
  it('shows Korean failures with retry, retains dismissed warnings for the output menu, and clears on recovery', () => {
    const {push, target, retryPlayback} = setup();
    const problems: PlaybackProblems = [
      {
        source: 'screen',
        name: '청중 화면',
        kinds: ['playback'],
        renderer: 'running',
      },
    ];
    push(problems);
    const card = target.report.mock.lastCall?.[0];
    expect(card?.title).toBe('청중 화면 미디어 재생 실패');
    expect(card?.actions?.[0]?.label).toBe('다시 시도');
    push(problems);
    expect(target.report).toHaveBeenCalledOnce();
    act(() => card?.actions?.[0]?.onSelect());
    expect(retryPlayback).toHaveBeenCalledWith({source: 'screen'});
    expect(useOutputWarnings.getState().warnings.size).toBe(1);
    push([]);
    expect(target.dismiss).toHaveBeenCalledWith('playback:screen:playback');
    expect(useOutputWarnings.getState().warnings.size).toBe(0);
    const count = target.report.mock.calls.length;
    act(() => card?.actions?.[0]?.onSelect());
    expect(target.report).toHaveBeenCalledTimes(count);
  });

  it('shows missing-device fallback and suppresses stale playback warnings while audio restarts', () => {
    const {push, target} = setup();
    push([
      {
        source: 'audio',
        name: '오디오',
        kinds: ['device-missing'],
        renderer: 'running',
      },
    ]);
    expect(target.report.mock.lastCall?.[0]).toMatchObject({
      title: '오디오 출력 장치 연결 끊김',
      meta: ['Windows 기본 장치로 재생 중'],
    });
    push([
      {
        source: 'audio',
        name: '오디오',
        kinds: ['device-missing'],
        renderer: 'limited',
      },
    ]);
    expect(target.report.mock.lastCall?.[0]?.title).toBe(
      '오디오 다시 시작 중단',
    );
    expect(target.dismiss).toHaveBeenCalledWith(
      'playback:audio:device-missing',
    );
    push([]);
    expect(target.dismiss).toHaveBeenCalledWith('playback:audio:limited');
  });

  it('ignores an older initial read after a recovery push and unsubscribes on unmount', async () => {
    let resolve: (value: PlaybackProblems) => void = () => undefined;
    const initial = new Promise<PlaybackProblems>(done => {
      resolve = done;
    });
    const {push, target, unmount, unsubscribe} = setup(initial);
    push([]);
    await act(async () =>
      resolve([
        {
          source: 'audio',
          name: '오디오',
          kinds: ['playback'],
          renderer: 'running',
        },
      ]),
    );
    expect(target.report).not.toHaveBeenCalled();
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not claim default-device playback when that device change also failed', () => {
    const {push, target} = setup();
    push([
      {
        source: 'audio',
        name: '오디오',
        kinds: ['device-missing'],
        renderer: 'running',
      },
    ]);
    target.report.mockClear();
    push([
      {
        source: 'audio',
        name: '오디오',
        kinds: ['device-missing', 'device-failed'],
        renderer: 'running',
      },
    ]);
    const missing = target.report.mock.calls.find(([notice]) =>
      notice.key.endsWith('device-missing'),
    )?.[0];
    expect(missing).toBeDefined();
    expect(missing?.meta).toBeUndefined();
  });
});
