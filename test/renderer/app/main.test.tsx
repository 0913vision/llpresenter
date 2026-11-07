import {isValidElement, type ReactNode} from 'react';
import {act, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {ControlSession} from '@renderer/app/controlSession';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {createAppFlushRequestId} from '@core/schema/ids';
import type {AppFlushRequest} from '@core/schema/appFlush';

const root = vi.hoisted(() => ({render: vi.fn(), unmount: vi.fn()}));
const stops = vi.hoisted(() => ({live: vi.fn(), service: vi.fn()}));
vi.mock('react-dom/client', () => ({createRoot: () => root}));
vi.mock('@renderer/session/live', () => ({startLiveSync: () => stops.live}));
vi.mock('@renderer/session/show', () => ({
  startServiceSync: () => stops.service,
}));

it('creates a window session outside render and releases its resources on pagehide once', async () => {
  const fixture = editorFixture();
  const uiState = {mediaStrip: false, layout: {narrow: {leftCollapsed: true}}};
  vi.spyOn(fixture.api.ui, 'get').mockResolvedValue(uiState);
  window.llp = fixture.api;
  const container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  try {
    await act(async () => {
      await import('@renderer/app/main');
    });
    await waitFor(() => expect(root.render).toHaveBeenCalledTimes(1));
    const tree: unknown = root.render.mock.calls[0]?.[0];
    if (
      !isValidElement<{children: ReactNode}>(tree) ||
      !isValidElement<{session: unknown; uiState: unknown}>(tree.props.children)
    ) {
      throw new Error('Missing application element');
    }
    const session = tree.props.children.props.session;
    expect(tree.props.children.props.uiState).toEqual(uiState);
    if (!(session instanceof ControlSession)) {
      throw new Error('Missing control session');
    }
    expect(session.editor).toBeDefined();
    expect(fixture.listenerCount()).toBe(4);
    const dispose = vi.spyOn(session, 'dispose');
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await waitFor(() => expect(fixture.listenerCount()).toBe(0));
    window.dispatchEvent(new Event('pagehide'));
    expect(root.unmount).toHaveBeenCalledTimes(1);
    expect(stops.live).toHaveBeenCalledTimes(1);
    expect(stops.service).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  } finally {
    window.dispatchEvent(new Event('pagehide'));
    container.remove();
    delete window.llp;
  }
});

it('releases startup subscriptions if the page hides before UI state loads', async () => {
  vi.resetModules();
  root.render.mockClear();
  root.unmount.mockClear();
  stops.live.mockClear();
  stops.service.mockClear();
  const fixture = editorFixture();
  let resolveUi:
    | ((value: Awaited<ReturnType<typeof fixture.api.ui.get>>) => void)
    | undefined;
  vi.spyOn(fixture.api.ui, 'get').mockReturnValue(
    new Promise(resolve => {
      resolveUi = resolve;
    }),
  );
  window.llp = fixture.api;
  const container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  try {
    await act(async () => {
      await import('@renderer/app/main');
    });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(stops.live).toHaveBeenCalledTimes(1);
    expect(stops.service).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveUi?.({});
    });
    expect(root.render).not.toHaveBeenCalled();
  } finally {
    container.remove();
    delete window.llp;
  }
});

it('flushes focused property drafts and queued writes in the settings renderer before answering close', async () => {
  vi.resetModules();
  root.render.mockClear();
  root.unmount.mockClear();
  stops.live.mockClear();
  stops.service.mockClear();
  let request: (value: AppFlushRequest) => void = () => undefined;
  const unsubscribe = vi.fn();
  const flushDone = vi.fn();
  const savePending = vi.fn(async () => true);
  const api = mockLlpApi({
    app: {
      subscribeFlushRequests: listener => {
        request = listener;
        return unsubscribe;
      },
      flushDone,
      savePending,
    },
  });
  window.llp = api;
  const originalUrl = window.location.href;
  window.history.replaceState({}, '', '?window=settings');
  const container = document.createElement('div');
  container.id = 'root';
  const input = document.createElement('input');
  document.body.append(container, input);
  let release: () => void = () => undefined;
  const pending = new Promise<void>(resolve => {
    release = resolve;
  });
  let submitted = Promise.resolve();
  try {
    await act(async () => {
      await import('@renderer/app/main');
    });
    const {pendingWritesOf: writesOf} =
      await import('@renderer/platform/pendingWrites');
    input.addEventListener('blur', () => {
      submitted = writesOf(api).run({
        write: () => pending,
        refused: undefined,
        sent: () => true,
      });
    });
    input.focus();
    const requestId = createAppFlushRequestId(
      '00000000-0000-4000-8000-000000000001',
    );
    request({requestId});
    expect(document.activeElement).not.toBe(input);
    expect(writesOf(api).isStopped).toBe(true);
    expect(savePending).not.toHaveBeenCalled();
    release();
    await submitted;
    await waitFor(() =>
      expect(flushDone).toHaveBeenCalledWith({requestId, result: true}),
    );
    window.dispatchEvent(new Event('pagehide'));
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(root.unmount).toHaveBeenCalledOnce();
    expect(stops.live).toHaveBeenCalledOnce();
    expect(stops.service).not.toHaveBeenCalled();
  } finally {
    release();
    await submitted;
    window.dispatchEvent(new Event('pagehide'));
    container.remove();
    input.remove();
    delete window.llp;
    window.history.replaceState({}, '', originalUrl);
  }
});

it.each([{name: 'screens', title: '화면 설정'}])(
  'starts the $name window page without the application and releases it on pagehide',
  async ({name, title}) => {
    vi.resetModules();
    root.render.mockClear();
    root.unmount.mockClear();
    stops.live.mockClear();
    stops.service.mockClear();
    window.llp = mockLlpApi();
    const originalUrl = window.location.href;
    window.history.replaceState({}, '', `?window=${name}`);
    const container = document.createElement('div');
    container.id = 'root';
    document.body.append(container);
    try {
      await act(async () => {
        await import('@renderer/app/main');
      });
      await waitFor(() => expect(root.render).toHaveBeenCalledOnce());
      expect(document.title).toBe(title);
      expect(stops.service).not.toHaveBeenCalled();
      window.dispatchEvent(new Event('pagehide'));
      expect(root.unmount).toHaveBeenCalledOnce();
      expect(stops.live).toHaveBeenCalledOnce();
    } finally {
      container.remove();
      delete window.llp;
      window.history.replaceState({}, '', originalUrl);
    }
  },
);
