import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {settingsDocument} from '@core/testing/settingsDocument';
import {themeScreens} from '@core/testing/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {ScreenFrames} from '@renderer/rendering/screenFrames';
import {act, cleanup, render, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {classes} from '@renderer/rendering/classes';
import {useLive} from '@renderer/session/live';
import {ScreenPreview} from './ScreenPreview';

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

it('remounts the current frame instantly with the same transition mechanism as output reveal', async () => {
  const first = render(<ScreenPreview screenId="main" chroma={false} />);
  await waitFor(() =>
    expect(first.container.textContent).toContain('Current frame'),
  );
  expect(
    first.container
      .querySelector(`.${classes.root}`)
      ?.classList.contains(classes.instant),
  ).toBe(true);
  first.unmount();
  const second = render(<ScreenPreview screenId="main" chroma={false} />);
  await waitFor(() =>
    expect(second.container.textContent).toContain('Current frame'),
  );
  const root = second.container.querySelector(`.${classes.root}`);
  expect(root?.classList.contains(classes.instant)).toBe(true);
  expect(second.container.textContent).toContain('Current frame');
  act(() => {
    const current = useLive.getState().state;
    if (current === null) throw new Error('Missing state');
    useLive.setState({
      state: {
        ...current,
        version: 2,
        layers: {
          ...current.layers,
          slide: {
            itemId: 'fixture',
            position: 1,
            label: null,
            lines: ['Next frame'],
          },
        },
      },
    });
  });
  expect(root?.classList.contains(classes.instant)).toBe(false);
  expect(second.container.textContent).toContain('Next frame');
});

it('keeps the last good preview after a frame error and draws a later good snapshot', async () => {
  const mockLog = vi.spyOn(
    window.llp?.log ?? {write: () => undefined},
    'write',
  );
  const view = render(<ScreenPreview screenId="main" chroma={false} />);
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
