import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {resolveThemeOutput} from '@core/themes/output';
import {themeFile, themeScreens} from '@core/testing/themeOutput';
import {screensDocument} from '@core/testing/screenDocuments';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {MISSING_STILL_BACKGROUND_TIP} from '@renderer/platform/problemReasons';
import {TestScreenSummaries} from '@renderer/platform/testing/screenSummaries';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';
import {
  mediaFixture,
  mediaDocument,
  mediaId,
  mediaItem,
} from '@renderer/features/media/mediaTesting';
import {PreviewPanel} from './PreviewPanel';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

afterEach(() => {
  cleanup();
  resetTooltips();
  delete window.llp;
  useLive.setState({state: null});
});

it('marks missing live videos from the shared media feed and removes the mark after relinking', async () => {
  const fixture = mediaFixture(
    mediaDocument([mediaItem(1), mediaItem(2, {kind: 'image'})]),
  );
  const get = fixture.api.settings.get;
  vi.spyOn(fixture.api.settings, 'get').mockImplementation(request =>
    request.name === 'screens'
      ? Promise.resolve(screensDocument())
      : get(request),
  );
  window.llp = fixture.api;
  const item = {id: 'invented', kind: 'media', source: 'external'} as const;
  const state = {
    ...emptyLiveState(),
    themeItem: item,
    themeOutput: resolveThemeOutput({
      file: themeFile(),
      screens: themeScreens,
      item,
      revision: 1,
    }),
  };
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        media: {mediaId: mediaId(1), loop: true, startedAt: 0},
      },
    },
  });
  render(
    <TestScreenSummaries>
      <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
        <PreviewPanel compact={false} />
      </MediaViewProvider>
    </TestScreenSummaries>,
  );
  act(() => fixture.pushMissing([mediaId(1)]));
  await waitFor(() =>
    expect(
      screen.getAllByRole('img', {name: MISSING_STILL_BACKGROUND_TIP}),
    ).toHaveLength(1),
  );
  act(() => fixture.pushMissing([]));
  expect(
    screen.queryByRole('img', {name: MISSING_STILL_BACKGROUND_TIP}),
  ).toBeNull();
  act(() => {
    fixture.pushMissing([mediaId(2)]);
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          media: {mediaId: mediaId(2), loop: false, startedAt: 0},
        },
      },
    });
  });
  expect(
    screen.queryByRole('img', {name: MISSING_STILL_BACKGROUND_TIP}),
  ).toBeNull();
});

it('puts the pause tooltip only on theme frames that show the media content', async () => {
  const fixture = mediaFixture(mediaDocument([mediaItem(1)]));
  const api = fixture.api;
  const get = api.settings.get;
  vi.spyOn(api.settings, 'get').mockImplementation(request =>
    request.name === 'screens'
      ? Promise.resolve(screensDocument())
      : get(request),
  );
  window.llp = api;
  const item = {id: 'invented', kind: 'media', source: 'external'} as const;
  const state = {
    ...emptyLiveState(),
    themeItem: item,
    themeOutput: resolveThemeOutput({
      file: themeFile(),
      screens: themeScreens,
      item,
      revision: 1,
    }),
  };
  useLive.setState({
    state: {
      ...state,
      layers: {
        ...state.layers,
        media: {mediaId: mediaId(1), loop: true, startedAt: 0},
      },
    },
  });
  render(
    <TestScreenSummaries>
      <MediaViewProvider api={api} onProblem={vi.fn()}>
        <PreviewPanel compact={false} />
      </MediaViewProvider>
    </TestScreenSummaries>,
  );
  act(() => fixture.pushMissing([mediaId(1)]));
  await waitFor(() =>
    expect(
      screen.getAllByRole('img', {name: MISSING_STILL_BACKGROUND_TIP}),
    ).toHaveLength(1),
  );
  const marks = screen.getAllByRole('img', {
    name: MISSING_STILL_BACKGROUND_TIP,
  });
  expect(
    marks.map(mark =>
      mark.closest('[data-screen]')?.getAttribute('data-screen'),
    ),
  ).toEqual(['main']);
  const main = marks[0];
  if (!main) throw new Error('Missing main preview indicator');
  expect((await hoverForTooltip(main))?.textContent).toBe(
    MISSING_STILL_BACKGROUND_TIP,
  );
});
