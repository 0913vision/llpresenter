import {MAIN_SCREEN} from '@fixtures/core/screenIds';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeScreens} from '@fixtures/core/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {ScreenPreview} from '@renderer/features/presentation/ScreenPreview';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.llp = mockLlpApi({
    settings: {
      get: async ({name}) =>
        name === 'screens'
          ? settingsDocument('screens', {screens: themeScreens})
          : settingsDocument('timers', {timers: []}),
    },
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  const initial = emptyLiveState();
  useLive.setState({
    state: {
      ...initial,
      version: 1,
      themeOutput: resolveThemeOutput({
        file: null,
        screens: themeScreens,
        item: {id: 'fixture', kind: 'song', source: 'external'},
        revision: 1,
      }),
      layers: {
        ...initial.layers,
        slide: {
          itemId: 'fixture',
          position: 0,
          label: null,
          lines: ['Current frame'],
        },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
});

it('keeps the last good preview after a frame error and draws a later good snapshot', async () => {
  const mockLog = vi.spyOn(
    window.llp?.log ?? {write: () => undefined},
    'write',
  );
  const view = render(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  await waitFor(() =>
    expect(view.container.textContent).toContain('Current frame'),
  );
  const previous = view.container.textContent;
  const state = useLive.getState().state;
  if (state === null) throw new Error('Missing state');
  vi.spyOn(ScreenFrames.prototype, 'frame').mockImplementationOnce(() => {
    throw new Error('Invented frame failure');
  });
  act(() => useLive.setState({state: {...state, version: 2}}));
  expect(view.container.textContent).toBe(previous);
  expect(mockLog).toHaveBeenCalledWith(
    expect.objectContaining({level: 'error'}),
  );
  act(() =>
    useLive.setState({
      state: {
        ...state,
        version: 3,
        layers: {
          ...state.layers,
          slide: {
            itemId: 'fixture',
            position: 1,
            label: null,
            lines: ['Recovered preview'],
          },
        },
      },
    }),
  );
  expect(view.container.textContent).toContain('Recovered preview');
});

function shownHost(container: HTMLElement): HTMLElement | null {
  const screen = container.firstElementChild;
  const hosts = screen === null ? [] : [...screen.children];
  return (
    hosts.find(
      (host): host is HTMLElement =>
        host instanceof HTMLElement && host.style.visibility === 'visible',
    ) ?? null
  );
}

function queuedFrames(): () => void {
  const queued: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    queued.push(callback);
    return queued.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  return () => {
    for (const callback of queued.splice(0)) callback(performance.now());
  };
}

it('keeps following the live state while no panel shows it and shows the current picture when it mounts again', async () => {
  vi.spyOn(OutputRenderer.prototype, 'ready').mockReturnValue(true);
  const flush = queuedFrames();
  const first = render(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  await waitFor(() =>
    expect(first.container.textContent).toContain('Current frame'),
  );
  act(flush);
  first.unmount();
  const state = useLive.getState().state;
  if (state === null) throw new Error('Missing state');
  act(() =>
    useLive.setState({
      state: {
        ...state,
        version: 2,
        layers: {
          ...state.layers,
          slide: {
            itemId: 'fixture',
            position: 1,
            label: null,
            lines: ['Changed while away'],
          },
        },
      },
    }),
  );
  act(flush);
  const again = render(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  expect(shownHost(again.container)?.textContent).toContain(
    'Changed while away',
  );
  expect(again.container.textContent).not.toContain('Current frame');
});

it('gives a second panel of the same screen its own drawing', async () => {
  const first = render(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  const second = render(
    <ScreenPreview screenId={MAIN_SCREEN} chroma={false} />,
  );
  await waitFor(() => {
    expect(first.container.textContent).toContain('Current frame');
    expect(second.container.textContent).toContain('Current frame');
  });
  second.unmount();
  expect(first.container.textContent).toContain('Current frame');
});
