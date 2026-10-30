import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {MediaImportProgress} from '@core/schema/mediaEdit';
import {createMediaId} from '@core/schema/ids';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';
import {applyService} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {settingsDocument} from '@renderer/features/screens/testing/documents';
import {createMemoryColumnWidthStore} from './columnWidthStore';
import {useFileMediaImport} from './useFileMediaImport';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const failed: MediaImportProgress = {
  mediaId: createMediaId('00000000-0000-4000-8000-000000000001'),
  fileName: 'invented.mp4',
  phase: 'failed',
  percent: 25,
  message: 'Invented analysis failure',
};
const sessions: ControlSession[] = [];

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  applyService(null);
});
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  useLive.setState({state: null});
  delete window.llp;
});

it.each([
  {workspace: 'show', returned: true},
  {workspace: 'screens', returned: true},
  {workspace: 'show', returned: false},
  {workspace: 'screens', returned: false},
])(
  'reports import failures in $workspace with a closed bin, returned=$returned',
  async ({workspace, returned}) => {
    let push: (progress: MediaImportProgress) => void = () => undefined;
    const importMedia = vi.fn(async () => ({
      ok: true as const,
      value: [returned ? failed : {...failed, phase: 'copying' as const}],
    }));
    const api = fakeLlpApi({
      media: {
        import: importMedia,
        subscribeImports: listener => {
          push = listener;
          return () => undefined;
        },
      },
    });
    const get = api.settings.get;
    vi.spyOn(api.settings, 'get').mockImplementation(request =>
      request.name === 'screens'
        ? Promise.resolve(settingsDocument('screens', {screens: []}))
        : request.name === 'macros'
          ? Promise.resolve(
              settingsDocument('macros', {macros: [], collections: []}),
            )
          : get(request),
    );
    window.llp = api;
    const session = new ControlSession(api);
    sessions.push(session);
    render(
      <App
        session={session}
        columnWidthStore={createMemoryColumnWidthStore()}
        uiState={{mediaStrip: false}}
      />,
    );
    if (workspace === 'screens') {
      fireEvent.click(screen.getByRole('tab', {name: '화면 설정'}));
    }
    expect(screen.queryByRole('region', {name: '미디어 보관함'})).toBeNull();
    fireEvent.click(screen.getByRole('menuitem', {name: '파일'}));
    fireEvent.click(screen.getByRole('menuitem', {name: '가져오기'}));
    fireEvent.click(screen.getByRole('menuitem', {name: '미디어…'}));
    await act(async () => undefined);
    await waitFor(() => expect(importMedia).toHaveBeenCalledOnce());
    if (!returned) {
      expect(screen.queryByText('미디어를 가져오지 못함')).toBeNull();
      act(() => push({...failed, phase: 'analysing'}));
      expect(session.getNotices()).toHaveLength(0);
      act(() => push(failed));
    }
    await screen.findByText('미디어를 가져오지 못함');
    expect(session.getNotices()).toEqual([
      expect.objectContaining({
        key: `media-view:copy:${failed.mediaId}`,
        meta: [failed.fileName, 'Invented analysis failure'],
      }),
    ]);
    act(() => push(failed));
    expect(session.getNotices()).toHaveLength(1);
  },
);

it('releases the progress subscription and ignores late progress and import replies', async () => {
  let push: (progress: MediaImportProgress) => void = () => undefined;
  let finish: (jobs: readonly MediaImportProgress[]) => void = () => undefined;
  const stop = vi.fn();
  window.llp = fakeLlpApi({
    media: {
      subscribeImports: listener => {
        push = listener;
        return stop;
      },
      import: () =>
        new Promise(resolve => {
          finish = value => resolve({ok: true, value});
        }),
    },
  });
  const onProblem = vi.fn();
  const {result, unmount} = renderHook(() => useFileMediaImport(onProblem));
  act(() => result.current.onSelect?.());
  unmount();
  expect(stop).toHaveBeenCalledOnce();
  await act(async () => {
    push(failed);
    finish([failed]);
  });
  expect(onProblem).not.toHaveBeenCalled();
});
