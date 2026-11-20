import {MAIN_SCREEN, STAGE_SCREEN} from '@fixtures/core/screenIds';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {themeScreens} from '@fixtures/core/themeOutput';
import {resolveThemeOutput} from '@core/themes/output';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {
  ScreenPreview,
  cachedScreenPicture,
} from '@renderer/features/presentation/ScreenPreview';
import {previewAppearance} from '@renderer/features/songs/editor/songPreviewModel';
import {parsePictureRequest} from '@core/schema/picture';
import type {PictureSpec} from '@renderer/rendering/pictures/pictureService';

vi.mock('@renderer/rendering/pictures/Picture', () => ({
  Picture: ({layers}: PictureSpec) => (
    <div data-testid="cached-picture">{layers.slide?.lines.join(' ')}</div>
  ),
}));
vi.mock('@renderer/features/presentation/OutputMirror', () => ({
  OutputMirror: ({screenId}: {screenId: string}) => (
    <div data-testid="mirror">{screenId}</div>
  ),
}));

beforeEach(() => {
  window.llp = mockLlpApi({
    settings: {
      get: async ({name}) =>
        name === 'screens'
          ? settingsDocument('screens', {screens: themeScreens})
          : settingsDocument('timers', {timers: []}),
    },
  });
  const state = emptyLiveState();
  useLive.setState({
    state: {
      ...state,
      themeOutput: resolveThemeOutput({
        file: null,
        screens: themeScreens,
        item: {id: 'fixture', kind: 'song', source: 'external'},
        revision: 1,
      }),
      layers: {
        ...state.layers,
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

it('retains the last still while the live frame is temporarily unavailable', async () => {
  render(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  await waitFor(() =>
    expect(screen.getByTestId('cached-picture').textContent).toBe(
      'Current frame',
    ),
  );
  act(() => useLive.setState({state: null}));
  expect(screen.getByTestId('cached-picture').textContent).toBe(
    'Current frame',
  );
});

it('uses a cached picture for a static audience slide and follows changes', async () => {
  render(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  await waitFor(() =>
    expect(screen.getByTestId('cached-picture').textContent).toBe(
      'Current frame',
    ),
  );
  const state = useLive.getState().state;
  if (state?.layers.slide == null) {
    throw new Error('Missing state');
  }
  const slide = state.layers.slide;
  act(() =>
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {...slide, lines: ['Next frame']},
        },
      },
    }),
  );
  expect(screen.getByTestId('cached-picture').textContent).toBe('Next frame');
});

it('uses cached stills instead of waking inactive stage or audience outputs', async () => {
  const view = render(<ScreenPreview screenId={STAGE_SCREEN} chroma={false} />);
  await waitFor(() =>
    expect(screen.getByTestId('cached-picture').textContent).toBe(
      'Current frame',
    ),
  );
  view.rerender(<ScreenPreview screenId={MAIN_SCREEN} chroma={false} />);
  await waitFor(() =>
    expect(screen.getByTestId('cached-picture')).toBeTruthy(),
  );
  const state = useLive.getState().state;
  if (state === null) throw new Error('Missing state');
  act(() => useLive.setState({state: {...state, blackScreen: true}}));
  expect(screen.queryByTestId('mirror')).toBeNull();
  expect(screen.queryByTestId('cached-picture')).toBeNull();
  expect(view.container.querySelector('[data-black-screen]')).not.toBeNull();
  act(() => useLive.setState({state: {...state, blackScreen: false}}));
  expect(screen.getByTestId('cached-picture').textContent).toBe(
    'Current frame',
  );
});

it('caches a static stage slide with its audience sizing context', () => {
  const document = settingsDocument('screens', {screens: themeScreens});
  if (document.name !== 'screens') throw new Error('Missing screens');
  const appearance = previewAppearance({
    role: 'stage',
    themes: undefined,
    screens: document.value,
  });
  const theme = {
    ...appearance.theme,
    layout: {
      ...appearance.theme.layout,
      elements: appearance.theme.layout.elements.filter(
        element => element.kind !== 'clock' && element.kind !== 'timer',
      ),
    },
  };
  const state = useLive.getState().state;
  if (state === null) throw new Error('Missing state');
  const picture = cachedScreenPicture(
    state.layers,
    {
      screen: appearance.screen,
      theme,
      audience: appearance.audience,
      stageLyricLabelPosition: 'off',
    },
    state,
  );
  expect(picture?.appearance.audience?.screen.kind).toBe('audience');
  expect(picture?.appearance.stageLyricLabelPosition).toBe('off');
  expect(parsePictureRequest({spec: picture, inputs: ''}).ok).toBe(true);
  expect(
    cachedScreenPicture(
      state.layers,
      {
        screen: appearance.screen,
        theme,
        audience: appearance.audience,
        stageMessage: 'Cue',
      },
      state,
    ),
  ).toBeDefined();
});
