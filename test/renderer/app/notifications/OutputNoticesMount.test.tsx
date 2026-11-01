import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {
  OutputScreenStatus,
  OutputStatuses,
} from '@core/schema/outputStatus';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import {useOutputWarnings} from '@renderer/platform/outputWarnings';
import {applyService} from '@renderer/session/show';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];

function status(change: Partial<OutputScreenStatus> = {}): OutputScreenStatus {
  return {
    placement: 'fullscreen',
    renderer: 'running',
    fps: 60,
    fpsLow: false,
    monitor: 3,
    ...change,
  };
}

function setup(initial: OutputStatuses = {}) {
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 1080);
  const {api} = editorFixture();
  const listeners = new Set<(statuses: OutputStatuses) => void>();
  const stop = vi.fn();
  vi.spyOn(api.output, 'getStatus').mockResolvedValue(initial);
  vi.spyOn(api.output, 'subscribeStatus').mockImplementation(listener => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      stop();
    };
  });
  const findMonitors = vi.spyOn(api.output, 'findMonitors');
  const showWindow = vi.spyOn(api.output, 'showWindow');
  const retry = vi.spyOn(api.output, 'retry');
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  const view = render(
    <App session={session} columnWidthStore={createMemoryColumnWidthStore()} />,
  );
  return {
    push: (statuses: OutputStatuses): void => {
      act(() => {
        for (const listener of listeners) listener(statuses);
      });
    },
    stop,
    listeners,
    findMonitors,
    showWindow,
    retry,
    view,
  };
}

function lostCard(): HTMLElement {
  return screen.getByRole('alert', {name: '무대 모니터 연결 끊김'});
}

function limitCard(): HTMLElement {
  return screen.getByRole('alert', {
    name: '본 화면 출력 창을 다시 띄울 수 없음',
  });
}

beforeEach(() => {
  useOutputWarnings.setState({warnings: new Map()});
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});
afterEach(async () => {
  vi.useRealTimers();
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it('keeps the warning after a rescan or a retry that changes nothing', () => {
  const {push, findMonitors, retry} = setup();
  push({
    main: status({renderer: 'limited'}),
    stage: status({placement: 'monitorMissing'}),
  });
  act(() =>
    within(lostCard()).getByRole('button', {name: '모니터 다시 찾기'}).click(),
  );
  push({
    main: status({renderer: 'limited'}),
    stage: status({placement: 'monitorMissing'}),
  });
  act(() =>
    within(limitCard()).getByRole('button', {name: '다시 시도'}).click(),
  );
  expect(findMonitors).toHaveBeenCalledOnce();
  expect(retry).toHaveBeenCalledWith('main');
  expect(lostCard()).toBeDefined();
  expect(limitCard()).toBeDefined();
});

it('closes the warning when the screen switches to window mode or leaves', () => {
  const {push} = setup();
  push({
    main: status({placement: 'monitorMissing'}),
    stage: status({placement: 'monitorMissing'}),
  });
  push({
    main: status({placement: 'monitorMissing'}),
    stage: status({placement: 'window'}),
  });
  expect(
    screen.queryByRole('alert', {name: '무대 모니터 연결 끊김'}),
  ).toBeNull();
  push({});
  expect(
    screen.queryByRole('alert', {name: '본 화면 모니터 연결 끊김'}),
  ).toBeNull();
  expect(useOutputWarnings.getState().warnings.size).toBe(0);
});

it('opens no new card when the operator turns off a screen whose card is closed', () => {
  const {push} = setup();
  push({stage: status({placement: 'monitorMissing'})});
  act(() =>
    within(lostCard()).getByRole('button', {name: '알림 닫기'}).click(),
  );
  push({stage: status({placement: 'off'})});
  expect(
    screen.queryByRole('alert', {name: '무대 모니터 연결 끊김'}),
  ).toBeNull();
  expect(
    useOutputWarnings.getState().warnings.get('screen:stage')?.notice.meta,
  ).toEqual(['모니터 3', '출력 꺼짐']);
});

it('changes a showing card to 출력 꺼짐 when the output turns off', () => {
  const {push} = setup();
  push({stage: status({placement: 'monitorMissing'})});
  push({stage: status({placement: 'off'})});
  expect(within(lostCard()).getByText('출력 꺼짐')).toBeDefined();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
});

it('shows a closed warning again from the 출력 menu until it resolves', async () => {
  const {push} = setup();
  push({stage: status({placement: 'monitorMissing'})});
  act(() =>
    within(lostCard()).getByRole('button', {name: '알림 닫기'}).click(),
  );
  expect(
    screen.queryByRole('alert', {name: '무대 모니터 연결 끊김'}),
  ).toBeNull();

  await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
  await userEvent.click(
    screen.getByRole('menuitem', {name: 'stage 경고 보기'}),
  );
  expect(lostCard()).toBeDefined();

  push({stage: status()});
  await userEvent.click(screen.getByRole('menuitem', {name: '출력'}));
  expect(screen.queryByRole('menuitem', {name: 'stage 경고 보기'})).toBeNull();
});

it('warns about a monitor already missing at launch', async () => {
  setup({stage: status({placement: 'monitorMissing'})});
  expect(
    await screen.findByRole('alert', {name: '무대 모니터 연결 끊김'}),
  ).toBeDefined();
});

it('releases both status listeners when the app unmounts', () => {
  const {stop, listeners, view} = setup();
  expect(listeners.size).toBe(2);
  view.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
  expect(listeners.size).toBe(0);
});
