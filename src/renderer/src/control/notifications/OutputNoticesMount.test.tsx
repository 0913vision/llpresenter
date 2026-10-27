import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import type {
  OutputScreenStatus,
  OutputStatuses,
} from '@shared/schema/outputStatus';
import {editorFixture} from '@renderer/prep/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {useLive} from '@renderer/state/live';
import {useOutputWarnings} from '@renderer/state/outputWarnings';
import {applyService} from '@renderer/state/show';
import {NOTICE_LIFETIME_MS} from '@renderer/ui/Notification';
import {App} from '../App';
import {ControlSession} from '../controlSession';

vi.mock('@renderer/render/outputRenderer', () => ({
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
  let push: (statuses: OutputStatuses) => void = () => undefined;
  const stop = vi.fn();
  vi.spyOn(api.output, 'getStatus').mockResolvedValue(initial);
  vi.spyOn(api.output, 'subscribeStatus').mockImplementation(listener => {
    push = listener;
    return stop;
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
      act(() => push(statuses));
    },
    stop,
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

it('shows 무대 모니터 연결 끊김 with its two actions when the stage monitor goes away', () => {
  const {push, findMonitors, showWindow} = setup();
  push({stage: status()});
  push({stage: status({placement: 'monitorMissing'})});
  const card = screen.getByRole('alert', {name: '무대 모니터 연결 끊김'});
  expect(within(card).getByText('창으로 표시 중')).toBeDefined();
  act(() =>
    within(card).getByRole('button', {name: '모니터 다시 찾기'}).click(),
  );
  expect(findMonitors).toHaveBeenCalledOnce();
  act(() => within(lostCard()).getByRole('button', {name: '창 보기'}).click());
  expect(showWindow).toHaveBeenCalledWith('stage');
  expect(lostCard()).toBeDefined();
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

it('turns the warning into an information card that closes after six seconds', () => {
  const {push} = setup();
  push({stage: status({placement: 'monitorMissing'})});
  expect(
    screen.getByRole('alert', {name: '무대 모니터 연결 끊김'}),
  ).toBeDefined();
  vi.useFakeTimers();
  push({stage: status()});
  expect(screen.queryByRole('alert')).toBeNull();
  expect(
    screen.getByRole('status', {name: '무대 모니터 다시 연결됨'}),
  ).toBeDefined();
  act(() => {
    vi.advanceTimersByTime(NOTICE_LIFETIME_MS - 1);
  });
  expect(
    screen.getByRole('status', {name: '무대 모니터 다시 연결됨'}),
  ).toBeDefined();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(
    screen.queryByRole('status', {name: '무대 모니터 다시 연결됨'}),
  ).toBeNull();
});

it('warns about a monitor already missing at launch', async () => {
  setup({stage: status({placement: 'monitorMissing'})});
  expect(
    await screen.findByRole('alert', {name: '무대 모니터 연결 끊김'}),
  ).toBeDefined();
});

it('warns about the restart limit with 다시 시도', () => {
  const {push, retry} = setup();
  push({main: status({renderer: 'limited'})});
  const card = screen.getByRole('alert', {
    name: '본 화면 출력 창을 다시 띄울 수 없음',
  });
  act(() => within(card).getByRole('button', {name: '다시 시도'}).click());
  expect(retry).toHaveBeenCalledWith('main');
});

it('shows at most three cards', () => {
  const {push} = setup();
  push({
    main: status({placement: 'monitorMissing', renderer: 'limited'}),
    stage: status({placement: 'monitorMissing', renderer: 'limited'}),
  });
  expect(screen.getAllByRole('alert')).toHaveLength(3);
});

it('releases the status listener when the app unmounts', () => {
  const {stop, view} = setup();
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
