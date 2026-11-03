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
  window.llp = mockLlpApi({
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
    screens: summarizeScreens(screens.value.screens),
  };
}

const SETTINGS_FEEDS_PER_PREVIEW = 4;

describe('preview overlay wiring', () => {
  it('passes the three preview identities and stage text, then releases every feed', async () => {
    const {store, snapshot, removals, stopSettings, screens} = setup();
    const view = render(
      <ScreenSummariesContext value={screens}>
        <PreviewPanel compact={false} />
      </ScreenSummariesContext>,
    );
    await act(async () => {});
    const messages = [
      ...view.container.querySelectorAll(
        `[data-layer="message"] .${classes.shown}`,
      ),
    ].map(element => element.textContent);
    expect(messages).toEqual(
      expect.arrayContaining(['Main message', 'Caption message']),
    );
    expect(messages).toHaveLength(2);
    expect(
      view.container.querySelectorAll(
        `[data-kind="stageMessage"] .${classes.shown}`,
      ),
    ).toHaveLength(1);
    expect(
      view.container.querySelector(
        `[data-kind="stageMessage"] .${classes.shown}`,
      )?.textContent,
    ).toBe('Stage cue');
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
    expect(stopSettings).toHaveBeenCalledTimes(3 * SETTINGS_FEEDS_PER_PREVIEW);
    for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  });

  it('switches identities without retaining the prior renderer or listener', async () => {
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
      view.container.querySelector(
        `[data-kind="stageMessage"] .${classes.shown}`,
      )?.textContent,
    ).toBe('Stage cue');
    expect(stopSettings).toHaveBeenCalledTimes(SETTINGS_FEEDS_PER_PREVIEW);
    view.unmount();
    expect(stopSettings).toHaveBeenCalledTimes(2 * SETTINGS_FEEDS_PER_PREVIEW);
    for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  });
});
