import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  CAPTIONS,
  MAIN,
  overlaySettings,
} from '../../../main/live/testing/overlays';
import {LiveStore} from '../../../main/live/store';
import {useLive} from '../state/live';
import {PreviewPanel} from '../show/PreviewPanel';
import {ScreenPreview} from '../show/ScreenPreview';
import {classes} from './classes';

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
  useLive.setState({state: store.state});
  const removals: Array<ReturnType<typeof vi.fn>> = [];
  const originalSubscribe = useLive.subscribe;
  vi.spyOn(useLive, 'subscribe').mockImplementation(listener => {
    const stop = vi.fn(originalSubscribe(listener));
    removals.push(stop);
    return stop;
  });
  const stopSettings = vi.fn();
  window.llp = fakeLlpApi({
    settings: {
      get: () => Promise.resolve(settings.reader.get('screens')),
      subscribe: () => stopSettings,
    },
  });
  return {store, removals, stopSettings};
}

const SETTINGS_FEEDS_PER_PREVIEW = 3;

describe('preview overlay wiring', () => {
  it('passes the three preview identities and stage text, then releases every feed', async () => {
    const {store, removals, stopSettings} = setup();
    const view = render(<PreviewPanel compact={false} />);
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
        `[data-layer="stage-message"] .${classes.shown}`,
      ),
    ).toHaveLength(1);
    expect(
      view.container.querySelector(
        `[data-layer="stage-message"] .${classes.shown}`,
      )?.textContent,
    ).toBe('Stage cue');
    store.dispatch({type: 'layer.clear', target: 'message'});
    act(() => {
      useLive.setState({state: store.state});
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
    const view = render(<ScreenPreview screenId="main" chroma={false} />);
    await act(async () => {});
    expect(
      view.container.querySelector(`[data-layer="message"] .${classes.shown}`)
        ?.textContent,
    ).toBe('Main message');
    view.rerender(<ScreenPreview screenId="stage" chroma={false} />);
    await act(async () => {});
    expect(view.container.querySelectorAll(`.${classes.root}`)).toHaveLength(1);
    expect(
      view.container.querySelector(`[data-layer="message"] .${classes.shown}`),
    ).toBeNull();
    expect(
      view.container.querySelector(
        `[data-layer="stage-message"] .${classes.shown}`,
      )?.textContent,
    ).toBe('Stage cue');
    expect(stopSettings).toHaveBeenCalledTimes(SETTINGS_FEEDS_PER_PREVIEW);
    view.unmount();
    expect(stopSettings).toHaveBeenCalledTimes(2 * SETTINGS_FEEDS_PER_PREVIEW);
    for (const remove of removals) expect(remove).toHaveBeenCalledTimes(1);
  });
});
