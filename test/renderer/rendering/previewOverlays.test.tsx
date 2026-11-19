import {resolveThemeOutput} from '@core/themes/output';
import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {CAPTIONS, MAIN, overlaySettings, STAGE} from '@fixtures/core/overlays';
import {LiveStore} from '@main/live/store';
import {useLive} from '@renderer/session/live';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {ScreenPreview} from '@renderer/features/presentation/ScreenPreview';
import {ScreenSummariesContext} from '@renderer/platform/ScreenSummaries';
import {summarizeScreens} from '@renderer/platform/screens';
import {classes} from '@renderer/rendering/classes';
import {releaseKeptDrawings} from '@renderer/rendering/keptDrawings';

beforeEach(() => {
  useLive.setState({state: null});
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
});
afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
});

function setup() {
  const settings = overlaySettings();
  const store = new LiveStore();
  store.connectSettings(settings.reader);
  store.dispatch({
    type: 'message.send',
    text: 'Main message',
    targets: [MAIN],
    duration: null,
  });
  store.dispatch({
    type: 'message.send',
    text: 'Caption message',
    targets: [CAPTIONS],
    duration: null,
  });
  store.dispatch({type: 'stage.message.set', text: 'Stage cue'});
  const document = settings.reader.get('screens');
  if (document.name !== 'screens') throw new Error('Missing screens');
  const themeItem = {
    id: 'overlay-preview',
    kind: 'song',
    source: 'external',
  } as const;
  const themeOutput = resolveThemeOutput({
    file: null,
    screens: document.value.screens,
    item: themeItem,
    revision: 1,
  });
  const snapshot = () => ({...store.state, themeItem, themeOutput});
  useLive.setState({state: snapshot()});
  const removals: Array<ReturnType<typeof vi.fn>> = [];
  const originalSubscribe = useLive.subscribe;
  vi.spyOn(useLive, 'subscribe').mockImplementation(listener => {
    const stop = vi.fn(originalSubscribe(listener));
    removals.push(stop);
    return stop;
  });
  const stopSettings = vi.fn();
  const previewSource = vi
    .fn<(id: string) => Promise<null>>()
    .mockResolvedValue(null);
  window.llp = mockLlpApi({
    output: {previewSource},
    settings: {
      get: () => Promise.resolve(settings.reader.get('screens')),
      subscribe: () => stopSettings,
    },
  });
  const screens = settings.reader.get('screens');
  if (screens.name !== 'screens') throw new Error('Missing screen fixture');
  return {
    store,
    snapshot,
    removals,
    stopSettings,
    previewSource,
    screens: summarizeScreens(screens.value.screens),
  };
}

const SETTINGS_FEEDS_PER_PREVIEW = 4;

describe('preview overlay wiring', () => {
  it('subscribes to the three output mirrors without drawing the overlays again', async () => {
    const {store, snapshot, removals, stopSettings, screens, previewSource} =
      setup();
    const view = render(
      <ScreenSummariesContext value={screens}>
        <PreviewPanel />
      </ScreenSummariesContext>,
    );
    await act(async () => {});
    expect(previewSource.mock.calls.map(([id]) => id)).toEqual(
      expect.arrayContaining([MAIN, STAGE, CAPTIONS]),
    );
    expect(view.container.querySelectorAll('video')).toHaveLength(3);
    expect(
      view.container.querySelectorAll(`[data-layer="message"]`),
    ).toHaveLength(0);
    store.dispatch({type: 'layer.clear', target: 'message'});
    act(() => {
      useLive.setState({state: snapshot()});
    });
    expect(
      view.container.querySelectorAll(
        `[data-layer="message"] .${classes.shown}`,
      ),
    ).toHaveLength(0);
    view.unmount();
    expect(stopSettings).not.toHaveBeenCalled();
    releaseKeptDrawings();
    expect(stopSettings).not.toHaveBeenCalled();
    for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  });

  it('keeps the prior identity drawing when it switches and frees both on release', async () => {
    const {removals, stopSettings} = setup();
    const view = render(<ScreenPreview screenId={MAIN} chroma={false} />);
    await act(async () => {});
    expect(
      view.container.querySelector(`[data-layer="message"] .${classes.shown}`)
        ?.textContent,
    ).toBe('Main message');
    view.rerender(<ScreenPreview screenId={STAGE} chroma={false} />);
    await act(async () => {});
    expect(view.container.querySelectorAll(`.${classes.root}`)).toHaveLength(1);
    expect(
      view.container.querySelector(`[data-layer="message"] .${classes.shown}`),
    ).toBeNull();
    expect(
      view.container.querySelector('[data-stage-message-band]:not([hidden])')
        ?.textContent,
    ).toBe('Stage cue');
    expect(stopSettings).not.toHaveBeenCalled();
    view.unmount();
    releaseKeptDrawings();
    expect(stopSettings).toHaveBeenCalledTimes(2 * SETTINGS_FEEDS_PER_PREVIEW);
    for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  });
});
