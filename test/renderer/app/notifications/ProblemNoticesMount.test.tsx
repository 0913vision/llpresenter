import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {type AppProblem} from '@core/schema/appProblem';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
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

function setup(
  listed: readonly AppProblem[] | Promise<readonly AppProblem[]> = [],
) {
  vi.stubGlobal('innerWidth', 1920);
  vi.stubGlobal('innerHeight', 1080);
  const {api} = editorFixture();
  let push: (problem: AppProblem) => void = () => undefined;
  const stop = vi.fn();
  vi.spyOn(api.problems, 'list').mockImplementation(() =>
    Promise.resolve(listed),
  );
  const retrySaves = vi.spyOn(api.problems, 'retrySaves');
  vi.spyOn(api.problems, 'subscribe').mockImplementation(listener => {
    push = listener;
    return stop;
  });
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  const view = render(
    <App session={session} columnWidthStore={createMemoryColumnWidthStore()} />,
  );
  return {
    push: (problem: AppProblem): void => {
      act(() => push(problem));
    },
    stop,
    retrySaves,
    view,
  };
}

beforeEach(() => {
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it('releases the problem listener when the app unmounts', () => {
  const {stop, view} = setup();
  view.unmount();
  expect(stop).toHaveBeenCalledOnce();
});
