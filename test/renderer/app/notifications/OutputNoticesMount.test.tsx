import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {OutputStatuses} from '@core/schema/outputStatus';
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

it('releases both status listeners when the app unmounts', () => {
  const {stop, listeners, view} = setup();
  expect(listeners.size).toBe(2);
  view.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
  expect(listeners.size).toBe(0);
});
