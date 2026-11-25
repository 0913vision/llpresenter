import {describe, expect, it, vi} from 'vitest';
import {defaultPreferences} from '@core/schema/app/preferences';
import type {
  SettingsListener,
  SettingsReader,
} from '@core/schema/app/settingsReader';
import {emptyLiveState} from '@core/schema/live/live';
import type {MediaDocument} from '@core/schema/media/mediaEdit';
import {
  emptySettingsDocument,
  settingsDocument,
} from '@fixtures/core/settingsDocument';
import {themeScreens, themesDocument} from '@fixtures/core/themeOutput';
import {recordingLogger} from '@fixtures/main/displays/testing';
import {
  serviceFile,
  setUp,
  songFile,
} from '@fixtures/main/store/contentStoreFixtures';
import {HYMN_ONE_ID, itemId, SUNDAY_ID} from '@fixtures/main/store/testFiles';
import {
  liveItemOf,
  registerThemeOutput,
  type ThemeOutputData,
} from '@main/live/item/themeOutput';
import {LiveStore} from '@main/live/store';
import type {MediaListener} from '@main/store/media/mediaStore';

const OVERLAY = '00000000-0000-4000-8000-000000000301';
const OTHER_SONG = '00000000-0000-4000-8000-000000000999';
const NO_MEDIA: MediaDocument = {
  name: 'media',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llmedia',
    schemaVersion: 1,
    items: [],
    playlists: [],
    audioPlaylists: [],
  },
};

describe('liveItemOf', () => {
  function sunday(openServiceId: string | null = SUNDAY_ID) {
    const slides = songFile().data.slides;
    const second = slides[1]?.id ?? '';
    const {store} = setUp(
      [
        serviceFile(SUNDAY_ID, [
          {id: itemId(1), kind: 'header', name: '찬양'},
          {
            id: itemId(2),
            kind: 'song',
            name: '곡',
            song: HYMN_ONE_ID,
            slides,
            overlays: [
              {
                id: OVERLAY,
                name: '자막',
                from: second,
                to: second,
                screens: [],
                content: {text: '함께 찬양합니다'},
              },
            ],
          },
        ]),
      ],
      {openServiceId},
    );
    return store;
  }

  it('names a 라이브러리 song by its id, and nothing for a song that is not there', () => {
    const content = sunday();
    expect(liveItemOf(content, `library:${HYMN_ONE_ID}`)).toEqual({
      id: `library:${HYMN_ONE_ID}`,
      kind: 'song',
      source: 'external',
      title: '만복의 근원 하나님',
    });
    expect(liveItemOf(content, `library:${OTHER_SONG}`)).toBeUndefined();
    expect(liveItemOf(content, 'library:not-an-id')).toBeUndefined();
  });

  it('names an item of the open 예배 with its overlays at their slide positions', () => {
    expect(liveItemOf(sunday(), itemId(2))).toEqual({
      id: itemId(2),
      kind: 'song',
      source: 'service',
      title: '곡',
      overlays: [
        {
          id: OVERLAY,
          name: '자막',
          from: 2,
          to: 2,
          screens: [],
          content: {text: '함께 찬양합니다'},
        },
      ],
    });
  });

  it('names nothing for an item without slides, or when no 예배 is open', () => {
    expect(liveItemOf(sunday(), itemId(1))).toBeUndefined();
    expect(liveItemOf(sunday(null), itemId(2))).toBeUndefined();
  });
});

describe('registerThemeOutput', () => {
  function setup(read: Partial<ThemeOutputData> = {}) {
    const listeners = new Set<SettingsListener>();
    const mediaListeners = new Set<MediaListener>();
    const settings: SettingsReader = {
      get: name =>
        name === 'themes'
          ? themesDocument()
          : settingsDocument('screens', {screens: themeScreens}),
      preferences: () => defaultPreferences,
      subscribe: listener => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const store = new LiveStore(emptyLiveState(), () => 0);
    const dispatch = vi.spyOn(store, 'dispatch');
    const connect = vi.spyOn(store, 'connectThemes');
    const log = recordingLogger();
    const data: ThemeOutputData = {
      content: Promise.resolve(setUp().store),
      settings: Promise.resolve(settings),
      media: Promise.resolve({
        subscribe: listener => {
          mediaListeners.add(listener);
          return () => mediaListeners.delete(listener);
        },
      }),
      ...read,
    };
    const release = registerThemeOutput({store, data, log});
    const refreshes = (): number =>
      dispatch.mock.calls.filter(
        ([command]) => command.type === 'themes.refresh',
      ).length;
    return {release, connect, log, listeners, mediaListeners, refreshes};
  }

  it('connects the themes once the data is read and draws again when the themes, the screens or the media change', async () => {
    const output = setup();
    await vi.waitFor(() => expect(output.connect).toHaveBeenCalledOnce());
    expect(output.refreshes()).toBe(1);
    for (const listener of output.listeners) {
      listener(themesDocument());
      listener(settingsDocument('screens', {screens: themeScreens}));
      listener(emptySettingsDocument('labels'));
    }
    for (const listener of output.mediaListeners) listener(NO_MEDIA);
    expect(output.refreshes()).toBe(4);
  });

  it('lets go of every subscription when it is released', async () => {
    const output = setup();
    await vi.waitFor(() => expect(output.connect).toHaveBeenCalledOnce());
    output.release();
    expect(output.listeners.size).toBe(0);
    expect(output.mediaListeners.size).toBe(0);
  });

  it('connects nothing when it is released before the data is read, or when the data could not be read', async () => {
    const early = setup();
    early.release();
    const unread = setup({settings: Promise.resolve(null)});
    await Promise.resolve();
    await Promise.resolve();
    expect(early.connect).not.toHaveBeenCalled();
    expect(unread.connect).not.toHaveBeenCalled();
    expect(early.listeners.size + unread.listeners.size).toBe(0);
  });

  it('logs why it could not connect', async () => {
    const failed = setup({content: Promise.reject(new Error('disk gone'))});
    await vi.waitFor(() =>
      expect(failed.log.entries).toContainEqual(
        expect.objectContaining({
          level: 'error',
          message: 'could not connect theme output',
        }),
      ),
    );
  });
});
