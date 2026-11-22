import {expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/schema/liveCommand';
import {emptyLayers, emptyLiveState, type LiveLayers} from '@core/schema/live';
import {liveOverlay} from '@core/live/overlays';
import {
  createItemOverlayId,
  createMediaId,
  createServiceItemId,
  createThemeId,
} from '@core/schema/ids';
import type {LiveItem} from '@core/schema/liveTheme';
import {defaultPreferences} from '@core/schema/preferences';
import type {SettingsReader} from '@core/schema/settingsReader';
import type {Themes} from '@core/schema/themes';
import {BUILT_IN_THEME_IDS} from '@core/theme/builtIn/ids';
import {LiveStore} from '@main/live/store';
import {ThemeRuntime} from '@main/live/themeRuntime';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {shownText} from '@fixtures/core/liveSlide';
import {THEME_MAIN, themes, themeScreens} from '@fixtures/core/themeOutput';

const ITEM = createServiceItemId('00000000-0000-4000-8000-000000000201');
const GONE = createThemeId('00000000-0000-4000-8000-000000000999');
const PICTURE = createMediaId('00000000-0000-4000-8000-000000000601');

const overlay = (from: number, to: number) => ({
  id: createItemOverlayId('00000000-0000-4000-8000-000000000301'),
  name: 'Invented overlay',
  from,
  to,
  screens: [THEME_MAIN],
  content: {text: 'Invented text'},
});

function setup(
  overlays?: LiveItem['overlays'],
  layers: Partial<LiveLayers> = {},
) {
  let file: Themes = themes();
  let revision = 1;
  let service: LiveItem = {
    id: ITEM,
    kind: 'song',
    source: 'service',
    title: 'Invented song',
    ...(overlays === undefined ? {} : {overlays}),
  };
  const settings: Pick<SettingsReader, 'get'> = {
    get: name => {
      if (name === 'themes') return settingsDocument('themes', file, revision);
      if (name === 'screens') {
        return settingsDocument('screens', {screens: themeScreens});
      }
      throw new Error(`Unexpected settings: ${name}`);
    },
  };
  const onMissingTheme = vi.fn();
  let now = 1000;
  const store = new LiveStore(
    {...emptyLiveState(), layers: {...emptyLayers(), ...layers}},
    () => now,
  );
  store.connectThemes(
    new ThemeRuntime({
      settings,
      item: id => (id === ITEM ? service : undefined),
      onError: vi.fn(),
      onMissingTheme,
    }),
  );
  store.connectSettings({
    ...settings,
    preferences: () => defaultPreferences,
    subscribe: () => () => undefined,
  });
  store.connectMacros({run: history => history});
  const dispatch = (command: LiveCommand): void => {
    store.dispatch(command);
  };
  return {
    store,
    dispatch,
    onMissingTheme,
    slide: (position = 0, more: Partial<ReturnType<typeof shownText>> = {}) =>
      dispatch({
        type: 'slide.show',
        slide: {
          itemId: ITEM,
          position,
          ...shownText('가사', position + 1),
          ...more,
        },
      }),
    theme: () => store.state.themeOutput?.theme.id,
    save: (next: Partial<LiveItem>) => {
      service = {...service, ...next};
    },
    advance: (ms: number) => {
      now += ms;
    },
    edit: (change: (themes: Themes) => Themes) => {
      file = change(file);
      revision += 1;
      dispatch({type: 'themes.refresh'});
    },
  };
}

it('shows 대기 화면 with nothing live, and the theme of the live slide', () => {
  const {dispatch, slide, theme} = setup();
  dispatch({type: 'themes.refresh'});
  expect(theme()).toBe(BUILT_IN_THEME_IDS.standby);
  slide();
  expect(theme()).toBe(BUILT_IN_THEME_IDS.lyrics);
  slide(1, {theme: BUILT_IN_THEME_IDS.title});
  expect(theme()).toBe(BUILT_IN_THEME_IDS.title);
});

it('puts the own background of a slide before the one of its theme', () => {
  const {store, slide} = setup();
  slide(0, {theme: BUILT_IN_THEME_IDS.title});
  expect(store.state.themeOutput?.background.kind).toBe('gradient');
  slide(1, {
    theme: BUILT_IN_THEME_IDS.title,
    background: {kind: 'media', media: PICTURE},
  });
  expect(store.state.themeOutput?.background).toEqual({
    kind: 'media',
    media: PICTURE,
  });
});

it('draws a slide whose theme is gone with one that has its boxes, and says so once', () => {
  const {store, slide, theme, onMissingTheme} = setup();
  slide(0, {theme: GONE});
  expect(theme()).toBe(BUILT_IN_THEME_IDS.lyrics);
  expect(store.state.themeOutput?.missing).toEqual([GONE]);
  slide(1, {theme: GONE});
  expect(onMissingTheme).toHaveBeenCalledExactlyOnceWith(GONE);
});

it('holds a picked theme until another item starts', () => {
  const {dispatch, slide, theme} = setup();
  slide();
  dispatch({type: 'theme.set', themeId: BUILT_IN_THEME_IDS.blank});
  slide(1);
  expect(theme()).toBe(BUILT_IN_THEME_IDS.blank);
  dispatch({type: 'item.start', itemId: ITEM});
  slide(0);
  expect(theme()).toBe(BUILT_IN_THEME_IDS.lyrics);
});

it('follows an edit of the live theme and the colors of the screens', () => {
  const {store, slide, edit} = setup();
  slide();
  const before = store.state.themeOutput;
  edit(file => ({
    ...file,
    themes: file.themes.map(theme =>
      theme.id === BUILT_IN_THEME_IDS.lyrics
        ? {...theme, name: '바뀐 테마'}
        : theme,
    ),
  }));
  expect(store.state.themeOutput?.theme.name).toBe('바뀐 테마');
  expect(store.state.themeOutput?.revision).toBe(2);
  expect(store.state.themeOutput?.emptyColors).toEqual(before?.emptyColors);
  expect(before?.emptyColors[THEME_MAIN]).toBe('#123456');
});

it('keeps the theme of what is left after a clear, and 대기 화면 after the item stops', () => {
  const {store, dispatch, slide, theme} = setup();
  slide(0, {theme: BUILT_IN_THEME_IDS.title});
  dispatch({type: 'layer.clear', target: 'all'});
  expect(theme()).toBe(BUILT_IN_THEME_IDS.title);
  expect(store.state.item?.contentCleared).toBe(true);
  dispatch({type: 'clear.undo'});
  expect(store.state.item?.contentCleared).toBeUndefined();
  dispatch({type: 'item.stop'});
  expect(theme()).toBe(BUILT_IN_THEME_IDS.standby);
  expect(store.state.item).toBeNull();
});

it.each(['item.restore', 'clear.undo'] as const)(
  'brings a stopped item back through %s with its theme and its clocks',
  type => {
    const {store, dispatch, slide, theme, advance} = setup([overlay(1, 2)], {
      media: {mediaId: 'background', loop: true, startedAt: 500},
      prop: {propId: 'prop'},
    });
    slide();
    dispatch({type: 'theme.set', themeId: BUILT_IN_THEME_IDS.blank});
    const {layers} = store.state;
    dispatch({type: 'item.stop'});
    expect(store.state.canRestoreItem).toBe(true);
    expect(store.state.layers.slide).toBeNull();
    expect(store.state.layers.prop).toBe(layers.prop);
    advance(1000);
    dispatch({type});
    expect(store.state.canRestoreItem).toBe(false);
    expect(store.state.item?.id).toBe(ITEM);
    expect(store.state.layers.slide).toBe(layers.slide);
    expect(theme()).toBe(BUILT_IN_THEME_IDS.blank);
    expect(store.state.item?.overlayStartedAt).toBe(2000);
  },
);

it.each(['item', 'slide', 'media'] as const)(
  'forgets a stopped item when a new %s comes',
  kind => {
    const {store, dispatch, slide} = setup();
    slide();
    dispatch({type: 'item.stop'});
    if (kind === 'item') dispatch({type: 'item.start', itemId: ITEM});
    else if (kind === 'slide') slide();
    else {
      dispatch({type: 'media.show', media: {mediaId: 'new', loop: false}});
    }
    expect(store.state.canRestoreItem).toBe(false);
  },
);

it('reads the item again on each slide, so an overlay added meanwhile shows', () => {
  const {store, slide, save} = setup();
  slide(0);
  const startedAt = store.state.item?.startedAt;
  save({overlays: [overlay(2, 2)]});
  slide(1);
  expect(store.state.item?.startedAt).toBe(startedAt);
  expect(liveOverlay(store.state.item, THEME_MAIN)?.id).toBe(overlay(2, 2).id);
});

it('runs one overlay on through its range and starts it again on the way back', () => {
  const {store, dispatch, slide, advance} = setup([overlay(1, 2)]);
  slide(0);
  advance(500);
  slide(1);
  expect(store.state.item?.overlayStartedAt).toBe(1000);
  dispatch({type: 'layer.clear', target: 'all'});
  advance(1000);
  dispatch({type: 'clear.undo'});
  expect(store.state.item?.overlayStartedAt).toBe(2000);
  slide(2);
  advance(500);
  slide(0);
  expect(store.state.item?.overlayStartedAt).toBe(3000);
});

it('names an item that is not in the service by its slide', () => {
  const {store, dispatch} = setup();
  dispatch({
    type: 'slide.show',
    slide: {
      itemId: 'bible:invented',
      position: 0,
      kind: 'bible',
      title: '창세기 1:1',
      ...shownText('가'),
    },
  });
  expect(store.state.item).toMatchObject({
    kind: 'bible',
    source: 'external',
    title: '창세기 1:1',
  });
});

it('draws media the operator chose with the theme for media', () => {
  const {dispatch, theme} = setup();
  dispatch({
    type: 'media.show',
    media: {mediaId: PICTURE, loop: false, title: '영상'},
  });
  expect(theme()).toBe(BUILT_IN_THEME_IDS.media);
});
