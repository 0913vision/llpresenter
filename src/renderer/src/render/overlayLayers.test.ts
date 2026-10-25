import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers} from '@shared/live';
import {LiveStore} from '../../../main/live/store';
import {
  CAPTIONS,
  IMAGE_PROP,
  IMAGES,
  MAIN,
  NOTICE,
  overlaySettings,
  PROP,
  settingsDocument,
  STAGE,
} from '../../../main/live/testing/overlays';
import {parseLiveCommand} from '@shared/schema/liveCommand';
import {classes} from './classes';
import {DEFAULT_LYRIC_STYLE} from './lyricStyle';
import {OutputRenderer} from './outputRenderer';
import {OverlayImageView} from './overlayImage';
import type {RenderScreen} from './layer';

const disposers: Array<() => void> = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
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
  for (const dispose of disposers.splice(0)) dispose();
  vi.useRealTimers();
});

function setup() {
  const settings = overlaySettings();
  const store = new LiveStore();
  store.connectSettings(settings.reader);
  const parent = document.createElement('div');
  const onError = vi.fn();
  const renderer = new OutputRenderer(parent, {
    lyricStyle: DEFAULT_LYRIC_STYLE,
    mediaUrl: id => `https://media.test/${id}`,
    onError,
  });
  disposers.push(() => renderer.dispose());
  const send = (value: unknown): void => {
    const command = parseLiveCommand(value);
    if (!command.ok) throw new Error(JSON.stringify(command.error));
    store.dispatch(
      command.value,
      error => {
        throw error;
      },
      problem => {
        throw new Error(JSON.stringify(problem));
      },
    );
  };
  const render = (screen: RenderScreen = {id: MAIN, kind: 'audience'}): void =>
    renderer.render(store.state.layers, {
      screen,
      stageMessage: store.state.stageMessage ?? null,
    });
  const box = (kind: string) => parent.querySelector(`[data-layer="${kind}"]`);
  const shownText = (kind: string) =>
    box(kind)?.querySelector(`.${classes.shown}`)?.textContent ?? null;
  return {
    settings,
    store,
    parent,
    renderer,
    send,
    render,
    box,
    shownText,
    onError,
  };
}

describe('registered overlay layers', () => {
  it('logs an asynchronous notice drawing failure and still advances to the next image', () => {
    const images = vi.spyOn(OverlayImageView.prototype, 'show');
    const {send, render, onError} = setup();
    send({type: 'notice.start', noticeId: NOTICE});
    render();
    images.mockImplementationOnce(() => {
      throw new Error('Drawing failure');
    });
    expect(() => vi.advanceTimersByTime(5_000)).not.toThrow();
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      'could not draw the notice layer',
      expect.any(Error),
    );
    vi.advanceTimersByTime(5_000);
    expect(images).toHaveBeenLastCalledWith(IMAGES[2]);
  });

  it('draws the target message only and clears every reusable page at once', () => {
    const {store, send, render, renderer, box, shownText} = setup();
    send({
      type: 'message.send',
      text: 'Audience',
      targets: [MAIN],
      duration: 30,
    });
    send({
      type: 'message.send',
      text: 'Captions',
      targets: [CAPTIONS],
      duration: null,
    });
    render();
    expect(shownText('message')).toBe('Audience');
    const pages = [
      ...(box('message')?.querySelectorAll(`.${classes.page}`) ?? []),
    ];
    render({id: CAPTIONS, kind: 'audience'});
    expect(shownText('message')).toBe('Captions');
    render({id: STAGE, kind: 'stage'});
    expect(shownText('message')).toBeNull();
    renderer.render(store.state.layers);
    expect(shownText('message')).toBeNull();
    send({type: 'layer.clear', target: 'message'});
    render();
    expect(shownText('message')).toBeNull();
    expect([
      ...(box('message')?.querySelectorAll(`.${classes.page}`) ?? []),
    ]).toEqual(pages);
  });

  it('keeps the stage message above overlays, only on a stage screen, through all clears', () => {
    const {send, render, box, shownText} = setup();
    send({type: 'stage.message.set', text: 'Stage cue'});
    render();
    expect(shownText('stage-message')).toBeNull();
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBe('Stage cue');
    send({type: 'layer.clear', target: 'all'});
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBe('Stage cue');
    expect(
      Number(
        box('stage-message')
          ?.getAttribute('style')
          ?.match(/z-index: (\d+)/)?.[1],
      ),
    ).toBeGreaterThan(5);
    send({type: 'stage.message.set', text: null});
    render({id: STAGE, kind: 'stage'});
    expect(shownText('stage-message')).toBeNull();
  });

  it('advances notices at the shared clock interval and holds the final image without a timer', () => {
    const images = vi.spyOn(OverlayImageView.prototype, 'show');
    const {send, render, renderer} = setup();
    send({type: 'notice.start', noticeId: NOTICE});
    render();
    expect(images).toHaveBeenLastCalledWith(IMAGES[0]);
    vi.advanceTimersByTime(4_999);
    expect(images).toHaveBeenLastCalledWith(IMAGES[0]);
    vi.advanceTimersByTime(1);
    expect(images).toHaveBeenLastCalledWith(IMAGES[1]);
    vi.advanceTimersByTime(5_000);
    expect(images).toHaveBeenLastCalledWith(IMAGES[2]);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(100_000);
    expect(images).toHaveBeenLastCalledWith(IMAGES[2]);
    render({id: CAPTIONS, kind: 'audience'});
    expect(images).toHaveBeenLastCalledWith(null);
    renderer.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejoins a looping notice at its current image and releases pause, clear and disposal timers', () => {
    const images = vi.spyOn(OverlayImageView.prototype, 'show');
    const {settings, send, render, renderer} = setup();
    settings.update(
      settingsDocument(
        'notices',
        {
          sets: [
            {
              id: NOTICE,
              name: 'Loop',
              media: IMAGES,
              interval: 5,
              loop: true,
              targets: [MAIN],
            },
          ],
        },
        2,
      ),
    );
    send({type: 'notice.start', noticeId: NOTICE});
    vi.advanceTimersByTime(17_000);
    render();
    expect(images).toHaveBeenLastCalledWith(IMAGES[0]);
    vi.advanceTimersByTime(3_000);
    expect(images).toHaveBeenLastCalledWith(IMAGES[1]);
    send({type: 'notice.pause'});
    render();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    send({type: 'notice.start', noticeId: NOTICE});
    render();
    vi.advanceTimersByTime(5_000);
    expect(images).toHaveBeenLastCalledWith(IMAGES[2]);
    send({type: 'layer.clear', target: 'notice'});
    render();
    expect(vi.getTimerCount()).toBe(0);
    expect(images).toHaveBeenLastCalledWith(null);
    send({type: 'clear.undo'});
    render();
    expect(images).toHaveBeenLastCalledWith(IMAGES[2]);
    expect(vi.getTimerCount()).toBe(1);
    renderer.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('routes several image and text props and reuses their elements across clears', () => {
    const {send, render, box, shownText} = setup();
    send({type: 'prop.set', propId: PROP, on: true});
    send({type: 'prop.set', propId: IMAGE_PROP, on: true});
    render();
    expect(shownText('prop')).toBe('Fixture prop');
    expect(box('prop')?.querySelectorAll('img')).toHaveLength(4);
    send({type: 'layer.clear', target: 'prop'});
    render();
    send({type: 'clear.undo'});
    render();
    const elements = [...(box('prop')?.querySelectorAll('*') ?? [])];
    for (let change = 0; change < 100; change += 1) {
      send({type: 'layer.clear', target: 'prop'});
      render();
      expect(shownText('prop')).toBeNull();
      send({type: 'clear.undo'});
      render();
    }
    expect([...(box('prop')?.querySelectorAll('*') ?? [])]).toEqual(elements);
    render({id: CAPTIONS, kind: 'audience'});
    expect(shownText('prop')).toBeNull();
    expect(box('prop')?.querySelectorAll('img[src]')).toHaveLength(1);
    render({id: STAGE, kind: 'stage'});
    expect(box('prop')?.querySelectorAll('img[src]')).toHaveLength(0);
  });

  it('isolates an overlay drawing error from lyrics and later clears', () => {
    const {store, send, renderer, onError, parent} = setup();
    send({type: 'notice.start', noticeId: NOTICE});
    vi.spyOn(OverlayImageView.prototype, 'show').mockImplementation(() => {
      throw new Error('Image failure');
    });
    renderer.render(
      {
        ...store.state.layers,
        slide: {
          itemId: 'fixture',
          position: 0,
          label: null,
          lines: ['Still visible'],
        },
      },
      {screen: {id: MAIN, kind: 'audience'}},
    );
    expect(
      parent.querySelector('[data-layer="lyrics"]')?.textContent,
    ).toContain('Still visible');
    expect(onError).toHaveBeenCalledWith(
      'could not draw the notice layer',
      expect.any(Error),
    );
    renderer.render(emptyLayers());
    expect(
      parent
        .querySelector('[data-layer="lyrics"]')
        ?.querySelector(`.${classes.shown}`),
    ).toBeNull();
  });
});
