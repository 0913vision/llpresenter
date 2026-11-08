import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {
  parseMacroId,
  createMediaId,
  createServiceItemId,
  createThemeId,
} from '@core/schema/ids';
import type {ServiceItemOf} from '@core/schema/service';
import {LiveStore} from '@main/live/store';
import {ThemeRuntime} from '@main/live/themeRuntime';
import {followSlideAdvance} from '@main/live/slideAdvance';
import {projectSlides} from '@core/presentation/slides';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {overlaySettings} from '@fixtures/core/overlays';
import {slidesItem, SLIDE_PICTURE, SLIDES_ITEM} from '@fixtures/core/slides';
import {
  renderedVerseSlides,
  slidesBibleItem,
  VERSE_NEXT,
} from '@fixtures/core/slidesBible';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it('keeps text-only ad numbering through automatic picture advance and looping', () => {
  const {store, show, stop} = setup(true);
  show(0);
  expect(store.state.layers.slide?.textSlideNumber).toBe(1);
  vi.advanceTimersByTime(3000);
  expect(store.state.layers.slide?.picture).toBe(SLIDE_PICTURE);
  expect(store.state.layers.slide?.textSlideNumber).toBeUndefined();
  vi.advanceTimersByTime(3000);
  expect(store.state.layers.slide?.textSlideNumber).toBe(2);
  vi.advanceTimersByTime(3000);
  expect(store.state.layers.slide?.textSlideNumber).toBe(1);
  stop();
});

it('advances a retained measured sequence after the control leaves, remapping cuts before the live verse', () => {
  const previous = setup();
  previous.stop();
  const item = slidesBibleItem();
  let tiles = renderedVerseSlides(2);
  let refresh: (() => void) | undefined;
  const unsubscribe = vi.fn();
  const stop = followSlideAdvance({
    store: previous.store,
    sequence: id => (id === item.id ? {item, tiles} : undefined),
    send: previous.send,
    subscribeSequence: listener => {
      refresh = listener;
      return unsubscribe;
    },
  });
  const at = tiles.findIndex(tile => tile.sourceSlideId === VERSE_NEXT);
  const slide = slideLayerOf({itemId: item.id, index: at}, () => tiles);
  if (slide === null) throw Error('Missing live verse');
  previous.store.dispatch({type: 'slide.show', slide});
  const before = previous.store.state.layers.slide;
  tiles = renderedVerseSlides(3);
  refresh?.();
  expect(previous.store.state.layers.slide).toBe(before);
  expect(previous.send).not.toHaveBeenCalled();
  vi.advanceTimersByTime(3000);
  expect(previous.store.state.layers.slide).toMatchObject({
    picture: SLIDE_PICTURE,
    position: 5,
  });
  stop();
  expect(unsubscribe).toHaveBeenCalledOnce();
  const sent = previous.send.mock.calls.length;
  vi.advanceTimersByTime(3000);
  expect(previous.send).toHaveBeenCalledTimes(sent);
});

it.each<LiveCommand>([
  {type: 'layer.clear', target: 'media'},
  {type: 'layer.clear.toggle', target: 'media'},
  {type: 'layer.clear', target: 'slide'},
  {type: 'layer.clear.toggle', target: 'slide'},
  {type: 'item.stop'},
])(
  'keeps advance stopped after $type followed by projection refresh until explicit output',
  command => {
    const previous = setup();
    previous.stop();
    const item = slidesBibleItem();
    const tiles = renderedVerseSlides();
    let refresh: (() => void) | undefined;
    const stop = followSlideAdvance({
      store: previous.store,
      sequence: () => ({item, tiles}),
      send: previous.send,
      subscribeSequence: listener => {
        refresh = listener;
        return () => undefined;
      },
    });
    const slide = slideLayerOf({itemId: item.id, index: 1}, () => tiles);
    if (slide === null) throw Error('Missing live part');
    previous.store.dispatch({type: 'slide.show', slide});
    previous.store.dispatch(command);
    const stopped = previous.store.state.layers.slide;
    refresh?.();
    refresh?.();
    vi.advanceTimersByTime(10000);
    expect(previous.store.state.layers.slide).toBe(stopped);
    expect(previous.send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    previous.store.dispatch({type: 'slide.show', slide});
    vi.advanceTimersByTime(3000);
    expect(previous.store.state.layers.slide).toMatchObject({
      position: 2,
      biblePart: 2,
    });
    stop();
  },
);

function setup(loop = false, advance: number | null = 3) {
  const source = slidesItem();
  const {advance: _advance, ...slides} = source.slides;
  let item: ServiceItemOf<'slides'> | undefined = {
    ...source,
    slides: {
      ...slides,
      loop,
      ...(advance === null ? {} : {advance}),
    },
  };
  const original = item;
  const readSequence = (id: string) =>
    id !== item?.id ? undefined : {item, tiles: projectSlides(item)};
  const store = new LiveStore(undefined, () => Date.now());
  store.connectMacros({run: history => history});
  store.connectThemes(
    new ThemeRuntime({
      settings: overlaySettings().reader,
      item: id => ({
        id,
        kind: id === SLIDES_ITEM ? 'ad' : 'song',
        source: 'service',
      }),
      onError: vi.fn(),
    }),
  );
  const send = vi.fn((command: LiveCommand) => store.dispatch(command));
  const stop = followSlideAdvance({
    store,
    sequence: readSequence,
    send,
  });
  const show = (index: number) => {
    const current = readSequence(SLIDES_ITEM);
    const slide =
      current === undefined
        ? null
        : slideLayerOf({itemId: current.item.id, index}, () => current.tiles);
    if (slide === null) throw Error('Missing fixture slide');
    store.dispatch({type: 'slide.show', slide});
  };
  return {
    store,
    show,
    stop,
    send,
    item: original,
    replaceItem: (next: ServiceItemOf<'slides'> | undefined) => {
      item = next;
    },
  };
}

it.each([false, true])(
  'advances pictures and text with loop=%s and holds or wraps at the last slide',
  loop => {
    const {store, show, stop, send} = setup(loop);
    show(0);
    vi.advanceTimersByTime(3000);
    expect(store.state.layers.slide?.position).toBe(1);
    expect(store.state.layers.media?.mediaId).toBe(SLIDE_PICTURE);
    vi.advanceTimersByTime(3000);
    expect(store.state.layers.slide?.position).toBe(2);
    expect(store.state.layers.media).toBeNull();
    vi.advanceTimersByTime(3000);
    expect(store.state.layers.slide?.position).toBe(loop ? 0 : 2);
    expect(send).toHaveBeenCalledTimes(loop ? 3 : 2);
    stop();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it('restarts the interval on a manual step and on clicking the same slide again', () => {
  const {store, show, stop} = setup(true);
  show(0);
  vi.advanceTimersByTime(2000);
  show(1);
  vi.advanceTimersByTime(2000);
  expect(store.state.layers.slide?.position).toBe(1);
  show(1);
  vi.advanceTimersByTime(2999);
  expect(store.state.layers.slide?.position).toBe(1);
  vi.advanceTimersByTime(1);
  expect(store.state.layers.slide?.position).toBe(2);
  stop();
});

it.each<LiveCommand>([
  {type: 'layer.clear', target: 'all'},
  {type: 'layer.clear', target: 'slide'},
  {type: 'layer.clear', target: 'media'},
  {type: 'item.stop'},
  {
    type: 'item.start',
    itemId: createServiceItemId('00000000-0000-4000-8000-000000000905'),
  },
  {
    type: 'slide.show',
    slide: {itemId: 'other', position: 0, label: null, lines: ['Other item']},
  },
])(
  'stops on $type, including clearing an already empty media layer',
  command => {
    const {store, show, stop, send} = setup(true);
    show(0);
    store.dispatch(command);
    store.dispatch({
      type: 'output.set',
      screenId: '00000000-0000-4000-8000-000000000001',
      on: true,
    });
    vi.advanceTimersByTime(10000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  },
);

it('does not schedule manual-only slides and releases a running timer on disposal', () => {
  const manual = setup(false, null);
  manual.show(0);
  expect(vi.getTimerCount()).toBe(0);
  manual.stop();
  const automatic = setup(true);
  automatic.show(0);
  automatic.stop();
  vi.advanceTimersByTime(10000);
  expect(automatic.send).not.toHaveBeenCalled();
});

it('keeps the ad theme through picture changes and removes picture ownership on a background', () => {
  const {store, show, stop} = setup(true);
  show(0);
  const theme = {
    kind: 'manual',
    id: createThemeId('00000000-0000-4000-8000-000000000101'),
  } as const;
  store.dispatch({type: 'theme.set', themeId: theme.id});
  const themeId = store.state.themeOutput?.themeId;
  vi.advanceTimersByTime(3000);
  expect(store.state.themeItem).toMatchObject({
    id: SLIDES_ITEM,
    kind: 'ad',
    source: 'service',
  });
  expect(store.state.themeOutput?.themeId).toBe(themeId);
  expect(store.state.themeMode).toEqual(theme);
  store.dispatch({
    type: 'media.show',
    media: {mediaId: SLIDE_PICTURE, loop: false},
  });
  expect(store.state.layers.media?.itemId).toBeUndefined();
  expect(store.state.layers.media?.slidePicture).toBeUndefined();
  stop();
});

it.each([false, true])(
  'handles picture then F2 then text with background replacement=%s',
  replaced => {
    const {store, show, stop} = setup();
    show(0);
    vi.advanceTimersByTime(3000);
    const picture = store.state.layers.media;
    expect(picture?.slidePicture).toBe(true);
    store.dispatch({type: 'layer.clear.toggle', target: 'slide'});
    expect(store.state.layers.slide).toBeNull();
    expect(store.state.layers.media).toBe(picture);
    if (replaced) {
      store.dispatch({
        type: 'media.show',
        media: {mediaId: SLIDE_PICTURE, loop: false, itemId: SLIDES_ITEM},
      });
      expect(store.state.layers.media?.slidePicture).toBeUndefined();
    }
    const background = store.state.layers.media;
    show(2);
    expect(store.state.layers.slide?.lines).toEqual(['Last line']);
    expect(store.state.layers.media).toBe(replaced ? background : null);
    stop();
  },
);

const parsedMacro = parseMacroId('00000000-0000-4000-8000-000000000906');
if (!parsedMacro.ok) throw Error('Invalid macro fixture');
const MACRO = parsedMacro.value;

it.each([false, true])(
  'stops advance when a macro clears media with present=%s and leaves the slide unchanged',
  present => {
    const {store, show, stop, send} = setup(true);
    show(0);
    if (present) {
      store.dispatch({
        type: 'media.show',
        media: {mediaId: SLIDE_PICTURE, loop: false},
      });
    }
    const slide = store.state.layers.slide;
    store.connectMacros({
      run: (history, _command, context) =>
        context.apply(history, {type: 'layer.clear', target: 'media'}),
    });
    store.dispatch({type: 'macro.run', macroId: MACRO});
    expect(store.state.layers.slide).toBe(slide);
    vi.advanceTimersByTime(10000);
    expect(send).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  },
);

it('keeps the timer when the macro containing a clear is rejected', () => {
  const {store, show, stop, send} = setup();
  show(0);
  store.connectMacros({
    run: (history, _command, context) => {
      context.apply(history, {type: 'layer.clear', target: 'media'});
      throw Error('Mock macro failure');
    },
  });
  store.dispatch({type: 'macro.run', macroId: MACRO});
  vi.advanceTimersByTime(3000);
  expect(store.state.layers.slide?.position).toBe(1);
  expect(send).toHaveBeenCalledOnce();
  stop();
});

it.each(['manual', 'automatic'] as const)(
  'keeps a macro-selected background when %s text follows a picture',
  mode => {
    const {store, show, stop} = setup();
    show(0);
    vi.advanceTimersByTime(3000);
    expect(store.state.layers.media?.itemId).toBe(SLIDES_ITEM);
    store.connectMacros({
      run: (history, _command, context) =>
        context.apply(history, {
          type: 'media.show',
          media: {mediaId: SLIDE_PICTURE, loop: false},
        }),
    });
    store.dispatch({type: 'macro.run', macroId: MACRO});
    const background = store.state.layers.media;
    expect(background?.itemId).toBeUndefined();
    if (mode === 'manual') show(2);
    else vi.advanceTimersByTime(3000);
    expect(store.state.layers.slide?.position).toBe(2);
    expect(store.state.layers.media).toBe(background);
    stop();
  },
);

it('reads edited next text when a pending interval expires', () => {
  const {store, show, stop, item, replaceItem} = setup();
  show(1);
  vi.advanceTimersByTime(1000);
  replaceItem({
    ...item,
    slides: {
      ...item.slides,
      slides: item.slides.slides.map((slide, index) =>
        index === 2 ? {id: slide.id, text: 'Updated next text'} : slide,
      ),
    },
  });
  vi.advanceTimersByTime(2000);
  expect(store.state.layers.slide?.lines).toEqual(['Updated next text']);
  stop();
});

it('reads a replacement next picture when a pending interval expires', () => {
  const {store, show, stop, item, replaceItem} = setup();
  const replacement = createMediaId('00000000-0000-4000-8000-000000000907');
  show(0);
  vi.advanceTimersByTime(1000);
  replaceItem({
    ...item,
    slides: {
      ...item.slides,
      slides: item.slides.slides.map((slide, index) =>
        index === 1 ? {id: slide.id, media: replacement} : slide,
      ),
    },
  });
  vi.advanceTimersByTime(2000);
  expect(store.state.layers.slide?.picture).toBe(replacement);
  expect(store.state.layers.media?.mediaId).toBe(replacement);
  stop();
});

it('skips a removed next picture instead of sending the cached picture', () => {
  const {store, show, stop, item, replaceItem} = setup();
  show(0);
  replaceItem({
    ...item,
    slides: {
      ...item.slides,
      slides: item.slides.slides.filter((_, index) => index !== 1),
    },
  });
  vi.advanceTimersByTime(3000);
  expect(store.state.layers.slide).toMatchObject({
    position: 1,
    lines: ['Last line'],
  });
  expect(store.state.layers.slide?.picture).toBeUndefined();
  expect(store.state.layers.media).toBeNull();
  stop();
});

it('holds output when the item is removed while a timer is pending', () => {
  const {store, show, stop, send, replaceItem} = setup();
  show(0);
  replaceItem(undefined);
  vi.advanceTimersByTime(3000);
  expect(store.state.layers.slide?.position).toBe(0);
  expect(send).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
  stop();
});

it.each([false, true])(
  'uses the latest end of the sequence with loop=%s',
  loop => {
    const {store, show, stop, send, item, replaceItem} = setup(loop);
    show(1);
    replaceItem({
      ...item,
      slides: {...item.slides, slides: item.slides.slides.slice(0, 2)},
    });
    vi.advanceTimersByTime(3000);
    expect(store.state.layers.slide?.position).toBe(loop ? 0 : 1);
    expect(send).toHaveBeenCalledTimes(loop ? 1 : 0);
    stop();
  },
);
