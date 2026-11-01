import {beforeEach, describe, expect, it, vi} from 'vitest';
import {LIVE_STATE_LIMITS} from '@core/schema/liveLimits';
import {createMediaId, createThemeId} from '@core/schema/ids';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import {NOTICE, overlaySettings} from '@fixtures/core/overlays';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {recordingLogger} from '@fixtures/main/displays/testing';
import type {ContentStoreOptions} from '@main/store/contentStore';
import {serviceFile, setUp} from '@fixtures/main/store/contentStoreFixtures';
import {HYMN_ONE_ID, itemId, SUNDAY_ID} from '@fixtures/main/store/testFiles';
import {registerThemeOutput} from '@main/live/themes';
import {LiveStore} from '@main/live/store';

const mocks = vi.hoisted(() => {
  const runtimes: Array<{item: (id: string) => LiveThemeItem | undefined}> = [];
  return {runtimes};
});

vi.mock('@main/live/themeRuntime', () => ({
  ThemeRuntime: class MockThemeRuntime {
    constructor(options: {item: (id: string) => LiveThemeItem | undefined}) {
      mocks.runtimes.push(options);
    }
    refresh(): void {
      return;
    }
  },
}));

const flushPromises = (): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, 0);
  });

beforeEach(() => {
  mocks.runtimes.length = 0;
});

const THEME = createThemeId('00000000-0000-4000-8000-000000000301');
const HYMN_TITLE = '만복의 근원 하나님';
const SONG_ITEM = itemId(61);
const BIBLE_ITEM = itemId(62);
const MEDIA_ITEM = itemId(63);
const NOTICE_ITEM = itemId(64);
const SLOT_ITEM = itemId(65);
const MEDIA_ID = createMediaId(itemId(70));
const LONG_TEXT = 'x'.repeat(LIVE_STATE_LIMITS.textCharacters + 20);

const bibleItem = {
  id: BIBLE_ITEM,
  bible: {
    translation: 'invented',
    ref: '창세기 1:1',
    split: 'verse',
    reference: 'every',
    verseNumbers: true,
    translationName: false,
  },
};

function setup(
  options: Partial<Pick<ContentStoreOptions, 'openServiceId'>> = {
    openServiceId: SUNDAY_ID,
  },
) {
  const items = [
    {id: SONG_ITEM, song: HYMN_ONE_ID, theme: THEME, memo: LONG_TEXT},
    bibleItem,
    {id: MEDIA_ITEM, media: MEDIA_ID},
    {id: NOTICE_ITEM, notice: NOTICE},
    {id: SLOT_ITEM, slot: 'song', title: 'Open slot'},
  ];
  const {store: content} = setUp([serviceFile(SUNDAY_ID, items)], options);
  const settings = overlaySettings();
  const live = new LiveStore();
  const release = vi.fn();
  const connect = vi.spyOn(live, 'connectThemes').mockReturnValue(release);
  vi.spyOn(live, 'handles').mockReturnValue(true);
  const dispatch = vi.spyOn(live, 'dispatch').mockReturnValue(true);
  const log = recordingLogger();
  const data = {
    content: Promise.resolve(content),
    settings: Promise.resolve(settings.reader),
    media: Promise.resolve(null),
  };
  const stop = registerThemeOutput({store: live, data, log});
  return {stop, connect, dispatch, release, log, settings, content};
}

async function resolver(
  setupResult: ReturnType<typeof setup>,
): Promise<(id: string) => LiveThemeItem | undefined> {
  await vi.waitFor(() => expect(setupResult.connect).toHaveBeenCalledOnce());
  const runtime = mocks.runtimes.at(-1);
  if (runtime === undefined) throw new Error('no theme runtime was created');
  return runtime.item;
}

describe('registerThemeOutput item resolver', () => {
  it('describes a service song with its theme and a memo cut to the live limit', async () => {
    const item = await resolver(setup());
    expect(item(SONG_ITEM)).toEqual({
      id: SONG_ITEM,
      kind: 'song',
      source: 'service',
      theme: THEME,
      title: HYMN_TITLE,
      memo: LONG_TEXT.slice(0, LIVE_STATE_LIMITS.textCharacters),
    });
  });

  it('names a Bible item by its reference and a notice item by its set', async () => {
    const item = await resolver(setup());
    expect(item(BIBLE_ITEM)).toMatchObject({
      kind: 'bible',
      title: '창세기 1:1',
    });
    expect(item(NOTICE_ITEM)).toMatchObject({
      kind: 'notice',
      title: 'Fixture notices',
    });
  });

  it('describes a media item without a title while the media list is missing', async () => {
    const item = await resolver(setup());
    const described = item(MEDIA_ITEM);
    expect(described).toMatchObject({kind: 'media', source: 'service'});
    expect(described).not.toHaveProperty('title');
  });

  it('gives nothing for an item of another kind or an unknown id', async () => {
    const item = await resolver(setup());
    expect(item(SLOT_ITEM)).toBeUndefined();
    expect(item(itemId(99))).toBeUndefined();
  });

  it('gives nothing for a service item while no service is open', async () => {
    const item = await resolver(setup({openServiceId: null}));
    expect(item(SONG_ITEM)).toBeUndefined();
  });

  it('describes a library song from its id and gives nothing for an unknown or malformed id', async () => {
    const item = await resolver(setup());
    expect(item(`library:${HYMN_ONE_ID}`)).toMatchObject({
      id: `library:${HYMN_ONE_ID}`,
      kind: 'song',
      source: 'external',
      title: HYMN_TITLE,
    });
    expect(item(`library:${itemId(98)}`)).toBeUndefined();
    expect(item('library:not-an-id')).toBeUndefined();
  });
});

describe('registerThemeOutput connection', () => {
  it('refreshes themes once on connect and again for the themes and screens documents only', async () => {
    const result = setup();
    await resolver(result);
    expect(result.dispatch).toHaveBeenCalledTimes(1);
    expect(result.dispatch).toHaveBeenLastCalledWith(
      {type: 'themes.refresh'},
      expect.any(Function),
      expect.any(Function),
    );
    result.settings.update(settingsDocument('screens', {screens: []}));
    expect(result.dispatch).toHaveBeenCalledTimes(2);
    result.settings.update(settingsDocument('props', {props: []}));
    expect(result.dispatch).toHaveBeenCalledTimes(2);
  });

  it('removes the listener and releases the runtime on stop, and ignores later changes', async () => {
    const result = setup();
    await resolver(result);
    result.stop();
    expect(result.release).toHaveBeenCalledOnce();
    expect(result.settings.listeners.size).toBe(0);
    result.settings.update(settingsDocument('screens', {screens: []}));
    expect(result.dispatch).toHaveBeenCalledTimes(1);
  });

  it('connects nothing when it stops before the data arrives', async () => {
    const result = setup();
    result.stop();
    await flushPromises();
    expect(result.connect).not.toHaveBeenCalled();
    expect(result.release).not.toHaveBeenCalled();
  });

  it('connects nothing while the content or the settings are missing', async () => {
    const live = new LiveStore();
    const connect = vi.spyOn(live, 'connectThemes');
    const log = recordingLogger();
    const {reader} = overlaySettings();
    registerThemeOutput({
      store: live,
      data: {
        content: Promise.resolve(null),
        settings: Promise.resolve(reader),
        media: Promise.resolve(null),
      },
      log,
    });
    registerThemeOutput({
      store: live,
      data: {
        content: Promise.resolve(setUp().store),
        settings: Promise.resolve(null),
        media: Promise.resolve(null),
      },
      log,
    });
    await flushPromises();
    expect(connect).not.toHaveBeenCalled();
    expect(log.messages('error')).toEqual([]);
  });

  it('logs a rejected data promise instead of throwing', async () => {
    const live = new LiveStore();
    const log = recordingLogger();
    const failure = new Error('invented data failure');
    registerThemeOutput({
      store: live,
      data: {
        content: Promise.reject(failure),
        settings: Promise.resolve(null),
        media: Promise.resolve(null),
      },
      log,
    });
    await vi.waitFor(() =>
      expect(log.messages('error')).toContain('could not connect theme output'),
    );
  });
});
