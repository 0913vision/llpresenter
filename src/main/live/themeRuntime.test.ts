import {describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import {
  createServiceItemId,
  createItemOverlayId,
  createMediaId,
  parseLookId,
} from '@core/schema/ids';
import type {SettingsReader} from '@core/schema/settingsReader';
import {settingsDocument} from '@core/testing/settingsDocument';
import {looksDocument} from '@core/testing/screenDocuments';
import {
  THEME_MAIN,
  fixedThemeText,
  themeFile,
  themeScreens,
} from '@core/testing/themeOutput';
import {ThemeRuntime} from './themeRuntime';
import {LiveStore} from './store';
import {defaultPreferences} from '@core/schema/preferences';
import {themeOverlay} from '@core/themes/content';

const ITEM = createServiceItemId('00000000-0000-4000-8000-000000000201');

function setup(overlays?: LiveThemeItem['overlays']) {
  let file = themeFile();
  let revision = 1;
  const bible = file.defaults.bible;
  if (bible === undefined) throw new Error('Missing Bible theme');
  const service: LiveThemeItem = {
    id: ITEM,
    kind: 'song',
    source: 'service',
    title: 'Invented service song',
    theme: bible,
    ...(overlays === undefined ? {} : {overlays}),
  };
  const settings: Pick<SettingsReader, 'get'> = {
    get: name => {
      if (name === 'themes') return settingsDocument('themes', file, revision);
      if (name === 'screens') {
        return settingsDocument('screens', {screens: themeScreens});
      }
      if (name === 'looks') return looksDocument();
      throw new Error(`Unexpected settings: ${name}`);
    },
  };
  const runtime = new ThemeRuntime({
    settings,
    item: id => (id === ITEM ? service : undefined),
    onError: vi.fn(),
  });
  let now = 1000;
  const store = new LiveStore(undefined, () => now);
  store.connectThemes(runtime);
  store.connectSettings({
    ...settings,
    preferences: () => defaultPreferences,
    subscribe: () => () => undefined,
  });
  store.connectMacros({run: history => history});
  const dispatch = (command: LiveCommand) => {
    const skipped = vi.fn();
    store.dispatch(command, undefined, skipped);
    expect(skipped).not.toHaveBeenCalled();
  };
  const slide = (id = ITEM, reference?: string, position = 0) =>
    dispatch({
      type: 'slide.show',
      slide: {
        itemId: id,
        position,
        label: 'Verse',
        lines: ['Invented line'],
        ...(reference === undefined ? {} : {reference}),
      },
    });
  return {
    store,
    dispatch,
    slide,
    service,
    advance: (ms: number) => {
      now += ms;
    },
    current: () => file,
    edit: () => {
      file = {
        ...file,
        themes: file.themes.map(theme => ({
          ...theme,
          screens: {
            ...theme.screens,
            [THEME_MAIN]: {mode: {kind: 'own'}, elements: [fixedThemeText()]},
          },
        })),
      };
      revision++;
    },
  };
}

describe('main-process theme runtime', () => {
  it('starts with standby and selects the service theme inside the same batch as its slide', () => {
    const {store, dispatch, current} = setup();
    dispatch({type: 'themes.refresh'});
    expect(store.state.themeOutput?.themeId).toBe(current().standby.id);
    const listener = vi.fn();
    store.subscribe(listener);
    dispatch({
      type: 'live.batch',
      commands: [
        {type: 'item.start', itemId: ITEM},
        {
          type: 'slide.show',
          slide: {
            itemId: ITEM,
            position: 0,
            label: null,
            lines: ['Invented verse'],
          },
        },
      ],
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(store.state.themeOutput?.themeId).toBe(current().defaults.bible);
    expect(store.state.themeItem?.title).toBe('Invented service song');
  });

  it('holds a manually picked theme inside a service item and resets it on the next external Bible output', () => {
    const {store, dispatch, slide, current} = setup();
    slide();
    const song = current().defaults.song;
    if (song === undefined) throw new Error('Missing song theme');
    dispatch({type: 'theme.set', themeId: song});
    slide();
    expect(store.state.themeOutput?.themeId).toBe(song);
    slide(
      createServiceItemId('00000000-0000-4000-8000-000000000202'),
      'Invented 1:1',
    );
    expect(store.state.themeOutput?.themeId).toBe(current().defaults.bible);
    expect(store.state.themeItem?.source).toBe('external');
  });

  it('keeps the composition and fixed content after a clear, and restores item state through clear undo and toggle', () => {
    const {store, dispatch, slide, current} = setup();
    slide();
    dispatch({type: 'layer.clear', target: 'all'});
    expect(store.state.themeOutput?.themeId).toBe(current().defaults.bible);
    expect(store.state.themeItem?.contentCleared).toBe(true);
    expect(store.state.layers.slide).toBeNull();
    dispatch({type: 'clear.undo'});
    expect(store.state.layers.slide?.lines).toEqual(['Invented line']);
    expect(store.state.themeItem?.contentCleared).not.toBe(true);
    dispatch({type: 'layer.clear.toggle', target: 'all'});
    dispatch({type: 'layer.clear.toggle', target: 'all'});
    expect(store.state.themeItem?.contentCleared).not.toBe(true);
  });

  it('stops only item content, enters standby, and undoes back to the prior item', () => {
    const {store, dispatch, slide, current} = setup();
    slide();
    dispatch({
      type: 'message.show',
      message: {messageId: 'global', text: 'Keep this global message'},
    });
    dispatch({type: 'item.stop'});
    expect(store.state.themeItem).toBeNull();
    expect(store.state.themeOutput?.themeId).toBe(current().standby.id);
    expect(store.state.layers.message?.text).toBe('Keep this global message');
    dispatch({type: 'clear.undo'});
    expect(store.state.themeItem?.id).toBe(ITEM);
    expect(store.state.layers.slide?.lines).toEqual(['Invented line']);
  });

  it('publishes live theme edits with the new revision and reuses unchanged compositions between slides', () => {
    const {store, dispatch, slide, edit} = setup();
    slide();
    const original = store.state.themeOutput;
    slide();
    expect(store.state.themeOutput).toBe(original);
    edit();
    dispatch({type: 'themes.refresh'});
    expect(store.state.themeOutput?.revision).toBe(2);
    expect(
      store.state.themeOutput?.screens[THEME_MAIN]?.layout.elements[0]?.kind,
    ).toBe('text');
  });

  it('keeps a selected legacy Look until another item starts', () => {
    const {store, slide, dispatch, current} = setup();
    slide();
    const look = parseLookId('00000000-0000-4000-8000-0000000000a2');
    if (!look.ok) throw new Error('Invalid Look');
    dispatch({type: 'look.set', lookId: look.value});
    expect(store.state.themeMode?.kind).toBe('legacy');
    expect(store.state.themeOutput).toBeUndefined();
    slide();
    expect(store.state.themeOutput).toBeUndefined();
    dispatch({type: 'item.start', itemId: ITEM});
    expect(store.state.themeOutput?.themeId).toBe(current().defaults.bible);
  });

  it('clears metadata-only items with an undo snapshot and keeps a repeated clear idempotent', () => {
    const {store, dispatch} = setup();
    dispatch({type: 'item.start', itemId: ITEM});
    dispatch({type: 'layer.clear', target: 'all'});
    expect(store.state.canUndo).toBe(true);
    expect(store.state.themeItem?.contentCleared).toBe(true);
    dispatch({type: 'layer.clear', target: 'all'});
    dispatch({type: 'clear.undo'});
    expect(store.state.themeItem?.id).toBe(ITEM);
    expect(store.state.themeItem?.contentCleared).not.toBe(true);
  });

  it('admits theme resolution atomically and retains the last good output on invalid metadata', () => {
    const {store, slide} = setup();
    slide();
    const previous = store.state;
    const skipped = vi.fn();
    store.dispatch(
      {
        type: 'slide.show',
        slide: {
          itemId: 'external-invalid',
          position: 0,
          label: null,
          lines: ['Valid line'],
          title: 'x'.repeat(4001),
        },
      },
      undefined,
      skipped,
    );
    expect(store.state).toBe(previous);
    expect(skipped).toHaveBeenCalledWith(
      expect.objectContaining({reason: 'dropped'}),
    );
    slide();
    expect(store.state.layers.slide?.itemId).toBe(ITEM);
  });

  it('holds one overlay epoch through its range, pauses it across undo, and restarts on reentry', () => {
    const {store, dispatch, slide, advance} = setup([
      {
        id: createItemOverlayId('00000000-0000-4000-8000-000000000301'),
        name: 'Invented overlay',
        from: 1,
        to: 2,
        screens: [THEME_MAIN],
        content: {
          media: createMediaId('00000000-0000-4000-8000-000000000302'),
          loop: false,
          sound: true,
        },
      },
    ]);
    slide();
    expect(store.state.themeItem?.overlayStartedAt).toBe(1000);
    advance(500);
    slide(ITEM, undefined, 1);
    expect(store.state.themeItem?.overlayStartedAt).toBe(1000);
    dispatch({type: 'layer.clear', target: 'all'});
    advance(1000);
    dispatch({type: 'clear.undo'});
    expect(store.state.themeItem?.overlayStartedAt).toBe(2000);
    slide(ITEM, undefined, 2);
    advance(500);
    slide();
    expect(store.state.themeItem?.overlayStartedAt).toBe(3000);
  });

  it('retains the overlay position and playback epoch through F2, restore, and the next slide in the range', () => {
    const overlay = {
      id: createItemOverlayId('00000000-0000-4000-8000-000000000301'),
      name: 'Invented overlay',
      from: 2,
      to: 3,
      screens: [THEME_MAIN],
      content: {
        media: createMediaId('00000000-0000-4000-8000-000000000302'),
        loop: true,
        sound: true,
      },
    };
    const {store, dispatch, slide, advance} = setup([overlay]);
    slide(ITEM, undefined, 1);
    dispatch({type: 'layer.clear.toggle', target: 'slide'});
    expect(store.state.layers.slide).toBeNull();
    expect(store.state.themeItem?.slidePosition).toBe(1);
    expect(
      themeOverlay(
        store.state.themeItem ?? null,
        store.state.layers,
        THEME_MAIN,
      ),
    ).toEqual(overlay);
    advance(500);
    dispatch({type: 'layer.clear.toggle', target: 'slide'});
    expect(store.state.layers.slide?.position).toBe(1);
    dispatch({type: 'layer.clear.toggle', target: 'slide'});
    advance(500);
    slide(ITEM, undefined, 2);
    expect(store.state.themeItem?.slidePosition).toBe(2);
    expect(store.state.themeItem?.overlayStartedAt).toBe(1000);
    dispatch({type: 'layer.clear', target: 'all'});
    expect(
      themeOverlay(
        store.state.themeItem ?? null,
        store.state.layers,
        THEME_MAIN,
      ),
    ).toBeUndefined();
  });
});
