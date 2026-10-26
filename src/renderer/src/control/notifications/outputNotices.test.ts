import {describe, expect, it, vi} from 'vitest';
import type {
  OutputScreenStatus,
  OutputStatuses,
} from '@shared/schema/outputStatus';
import {
  outputNoticeChanges,
  type NoticeChange,
  type ScreenNames,
} from './outputNotices';

const TIME = '11:24';
const screens = new Map<string, ScreenNames>([
  ['main', {monitor: '본 화면', window: '본 화면'}],
  ['stage', {monitor: '무대', window: '무대 화면'}],
]);

function status(change: Partial<OutputScreenStatus> = {}): OutputScreenStatus {
  return {
    placement: 'fullscreen',
    renderer: 'running',
    fps: 60,
    fpsLow: false,
    ...change,
    monitor: change.monitor ?? 3,
  };
}

function changes(previous: OutputStatuses, next: OutputStatuses) {
  const actions = {
    findMonitors: vi.fn(),
    showWindow: vi.fn(),
    retry: vi.fn(),
  };
  const result = outputNoticeChanges({
    previous,
    next,
    screens,
    actions,
    time: TIME,
  });
  return {result, actions};
}

function shown(change: NoticeChange | undefined) {
  if (change?.kind !== 'show') throw new Error('Expected a shown notice');
  return change.notice;
}

describe('outputNoticeChanges, lost monitor', () => {
  it('warns that the stage monitor is lost, with its monitor and two actions', () => {
    const {result, actions} = changes(
      {stage: status()},
      {stage: status({placement: 'monitorMissing'})},
    );
    expect(result).toHaveLength(1);
    const notice = shown(result[0]);
    expect(notice).toMatchObject({
      key: 'screen:stage',
      kind: 'warning',
      icon: 'plug',
      title: '무대 모니터 연결 끊김',
      time: TIME,
      meta: ['모니터 3', '창으로 표시 중'],
    });
    expect(notice.actions?.map(action => action.label)).toEqual([
      '모니터 다시 찾기',
      '창 보기',
    ]);
    notice.actions?.[0]?.onSelect();
    notice.actions?.[1]?.onSelect();
    expect(actions.findMonitors).toHaveBeenCalledOnce();
    expect(actions.showWindow).toHaveBeenCalledWith('stage');
  });

  it('leaves the detail line out of the reconnected card without a monitor', () => {
    const missing: OutputScreenStatus = {
      placement: 'monitorMissing',
      renderer: 'running',
      fps: null,
      fpsLow: false,
    };
    const {result} = changes(
      {stage: missing},
      {stage: {...missing, placement: 'fullscreen', fps: 60}},
    );
    expect(shown(result[0])).not.toHaveProperty('meta');
  });

  it('turns the warning into information when the monitor is back', () => {
    const {result} = changes(
      {stage: status({placement: 'monitorMissing'})},
      {stage: status()},
    );
    expect(shown(result[0])).toEqual({
      key: 'screen:stage',
      kind: 'info',
      icon: 'monitor',
      title: '무대 모니터 다시 연결됨',
      time: TIME,
      meta: ['모니터 3'],
    });
  });

  it('only updates a showing card, to 출력 꺼짐 with 모니터 다시 찾기, when the output turns off while the monitor is missing', () => {
    const {result} = changes(
      {main: status({placement: 'monitorMissing', monitor: 2})},
      {main: status({placement: 'off', monitor: 2})},
    );
    expect(result[0]?.kind).toBe('update');
    if (result[0]?.kind !== 'update') throw new Error('Expected an update');
    const {notice} = result[0];
    expect(notice).toMatchObject({
      key: 'screen:main',
      kind: 'warning',
      title: '본 화면 모니터 연결 끊김',
      meta: ['모니터 2', '출력 꺼짐'],
    });
    expect(notice.actions?.map(action => action.label)).toEqual([
      '모니터 다시 찾기',
    ]);
  });

  it('clears a stale card when the screen goes full screen from off', () => {
    const {result} = changes(
      {main: status({placement: 'off'})},
      {main: status()},
    );
    expect(result).toEqual([{kind: 'dismiss', key: 'screen:main'}]);
  });

  it('warns about a monitor already missing in the first status', () => {
    const {result} = changes(
      {},
      {stage: status({placement: 'monitorMissing'})},
    );
    expect(shown(result[0]).title).toBe('무대 모니터 연결 끊김');
  });

  it('names no monitor when the screen never had one', () => {
    const missing: OutputScreenStatus = {
      placement: 'monitorMissing',
      renderer: 'running',
      fps: null,
      fpsLow: false,
    };
    const {result} = changes({}, {stage: missing});
    expect(shown(result[0]).meta).toEqual(['창으로 표시 중']);
  });

  it.each([
    ['turning on full screen', status({placement: 'off'}), status()],
    ['turning off', status(), status({placement: 'off'})],
    [
      'a window-method screen',
      status({placement: 'off'}),
      status({placement: 'window'}),
    ],
    ['a frame rate change', status(), status({fps: 41, fpsLow: true})],
  ])('shows nothing for %s', (_name, before, after) => {
    const {result} = changes({main: before}, {main: after});
    expect(result.filter(change => change.kind === 'show')).toEqual([]);
  });

  it('ignores screens it has no names for', () => {
    const {result} = changes(
      {},
      {other: status({placement: 'monitorMissing'})},
    );
    expect(result).toEqual([]);
  });

  it('closes both cards of a screen that leaves the status', () => {
    const {result} = changes(
      {stage: status({placement: 'monitorMissing', renderer: 'limited'})},
      {},
    );
    expect(result).toEqual([
      {kind: 'dismiss', key: 'screen:stage'},
      {kind: 'dismiss', key: 'output-window:stage'},
    ]);
  });

  it.each(['monitorMissing', 'off'] as const)(
    'closes the lost monitor card when a %s screen switches to window mode',
    was => {
      const {result} = changes(
        {stage: status({placement: was})},
        {stage: status({placement: 'window'})},
      );
      expect(result).toEqual([{kind: 'dismiss', key: 'screen:stage'}]);
    },
  );

  it('names the screen of each card it shows', () => {
    const {result} = changes(
      {},
      {stage: status({placement: 'monitorMissing'})},
    );
    expect(result[0]).toMatchObject({kind: 'show', screenId: 'stage'});
  });
});

describe('outputNoticeChanges, restart limit', () => {
  it('warns with 다시 시도 when the output window holds the limit', () => {
    const {result, actions} = changes(
      {main: status()},
      {main: status({renderer: 'limited'})},
    );
    const notice = shown(result[0]);
    expect(notice).toMatchObject({
      key: 'output-window:main',
      kind: 'warning',
      title: '본 화면 출력 창을 다시 띄울 수 없음',
      meta: ['빈 화면으로 표시 중'],
    });
    notice.actions?.[0]?.onSelect();
    expect(actions.retry).toHaveBeenCalledWith('main');
  });

  it('turns into information when an attempt works', () => {
    const {result} = changes(
      {stage: status({renderer: 'limited'})},
      {stage: status({renderer: 'running'})},
    );
    expect(shown(result[0])).toMatchObject({
      key: 'output-window:stage',
      kind: 'info',
      title: '무대 화면 출력 창 다시 띄움',
    });
  });

  it('says nothing while the window only restarts', () => {
    const {result} = changes(
      {main: status()},
      {main: status({renderer: 'restarting'})},
    );
    expect(result).toEqual([]);
  });

  it('reports a lost monitor and the limit of one screen together', () => {
    const {result} = changes(
      {main: status()},
      {main: status({placement: 'monitorMissing', renderer: 'limited'})},
    );
    expect(result.map(change => shown(change).key)).toEqual([
      'screen:main',
      'output-window:main',
    ]);
  });
});
