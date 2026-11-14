import {describe, expect, it, vi} from 'vitest';
import {parseService} from '@core/schema/service';
import {parseSong} from '@core/schema/song';
import type {MediaChoice} from '@core/live/state';
import type {OpenServiceSources} from '@main/store/openServiceFeed';
import {OpenServiceFeed} from '@main/store/openServiceFeed';
import type {StoredDocument} from '@main/store/documents';
import {
  service,
  SUNDAY_ID,
  HYMN_ONE_ID,
  hymnOne,
  itemId,
} from '@fixtures/main/store/testFiles';
import {
  parseBibleLookupRequest,
  type BibleLookupReply,
} from '@core/schema/bibleLookup';
import {createServiceItemId} from '@core/schema/ids';
import {parseBibleProjection} from '@core/schema/bibleProjection';
import type {SettingsReader} from '@core/schema/settingsReader';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {defaultPreferences} from '@core/schema/preferences';

async function setUp(
  backgroundOf: OpenServiceSources['backgroundOf'] = async () => null,
  bible?: OpenServiceSources['bible'],
  settings?: SettingsReader,
) {
  const parsed = parseService(
    JSON.stringify(service(SUNDAY_ID, '2026-11-01T11:00', [])),
    'service.llservice',
  );
  if (!parsed.ok) throw new Error(parsed.error.message);
  const current: StoredDocument<typeof parsed.value.data> = {
    ...parsed.value,
    file: 'service.llservice',
    revision: 1,
  };
  const content = {
    storedService: vi
      .fn<OpenServiceSources['content']['storedService']>()
      .mockReturnValue(current),
    storedSongs: vi
      .fn<OpenServiceSources['content']['storedSongs']>()
      .mockReturnValue(new Map()),
  };
  const push = vi.fn();
  const report = vi.fn();
  const feed = new OpenServiceFeed(
    {
      serviceId: SUNDAY_ID,
      labels: [],
      content,
      backgroundOf,
      ...(bible === undefined ? {} : {bible}),
      ...(settings === undefined ? {} : {settings}),
    },
    push,
    report,
  );
  await feed.refresh();
  push.mockClear();
  return {feed, content, current, push, report};
}

describe('OpenServiceFeed', () => {
  it('publishes measured cuts and rejects stale or incomplete projections', async () => {
    const request = parseBibleLookupRequest({
      translation: 'sample',
      input: '요한복음 3:16-18',
    });
    if (!request.ok) throw new Error('Invalid fixture');
    const lookup = vi
      .fn<NonNullable<OpenServiceSources['bible']>['lookup']>()
      .mockResolvedValue({
        ...request.value,
        suggestions: [],
        result: {
          ok: true,
          value: {
            translation: request.value.translation,
            ref: request.value.input,
            displayRef: request.value.input,
            verses: [16, 17, 18].map(verse => ({
              chapter: 3,
              verse,
              text: 'alpha beta',
            })),
          },
        },
      });
    let revision = 1;
    const settings: SettingsReader = {
      get: () => settingsDocument('bibleCuts', {entries: {}}, revision),
      preferences: () => defaultPreferences,
      subscribe: () => () => undefined,
    };
    const {feed, content, current} = await setUp(undefined, {lookup}, settings);
    const id = createServiceItemId(itemId(62));
    content.storedService.mockReturnValue({
      ...current,
      data: {
        ...current.data,
        order: [
          {
            id,
            bible: {
              translation: request.value.translation,
              ref: request.value.input,
              split: 'fit',
              reference: 'every',
              verseNumbers: true,
              translationName: false,
            },
          },
        ],
      },
    });
    await feed.refresh();
    const original = feed.current()?.tiles[id];
    if (
      original?.length !== 3 ||
      !original[0] ||
      !original[1] ||
      !original[2]
    ) {
      throw Error('Missing fixture');
    }
    const projection = parseBibleProjection({
      serviceId: SUNDAY_ID,
      itemId: id,
      revision: 1,
      measurement: {themes: 1, screens: 1, bibleCuts: 1},
      tiles: [
        {
          ...original[0],
          label: '요3:16 (1)',
          lines: ['16 alpha (계속)'],
          biblePart: 1,
          continued: true,
        },
        {
          ...original[0],
          label: '요3:16 (2)',
          lines: ['beta'],
          biblePart: 2,
          continued: false,
        },
        {...original[1], biblePart: 1, continued: false},
        {...original[2], biblePart: 1, continued: false},
      ],
    });
    if (!projection.ok) throw Error('Invalid projection');
    feed.acceptBibleProjection({...projection.value, revision: 2});
    await feed.refresh();
    expect(feed.current()?.tiles[id]).toHaveLength(3);
    feed.acceptBibleProjection({
      ...projection.value,
      tiles: projection.value.tiles.slice(0, 3),
    });
    await feed.refresh();
    expect(feed.current()?.tiles[id]).toHaveLength(3);
    feed.acceptBibleProjection(projection.value);
    await feed.refresh();
    expect(feed.current()?.tiles[id]?.map(tile => tile.label)).toEqual([
      '요3:16 (1)',
      '요3:16 (2)',
      '요3:17',
      '요3:18',
    ]);
    revision = 2;
    await feed.refresh();
    expect(feed.current()?.tiles[id]).toHaveLength(3);
    await feed.dispose();
  });
  it('starts each verse on a slide for a legacy 들어가는 만큼 passage', async () => {
    const request = parseBibleLookupRequest({
      translation: 'sample',
      input: '요한복음 3:16-18',
    });
    if (!request.ok) throw new Error('Invalid lookup fixture');
    const lookup = vi
      .fn<NonNullable<OpenServiceSources['bible']>['lookup']>()
      .mockResolvedValue({
        ...request.value,
        suggestions: [],
        result: {
          ok: true,
          value: {
            translation: request.value.translation,
            ref: request.value.input,
            displayRef: request.value.input,
            verses: [16, 17, 18].map(verse => ({chapter: 3, verse, text: 'a'})),
          },
        },
      });
    const item = {
      id: createServiceItemId(itemId(61)),
      bible: {
        translation: request.value.translation,
        ref: request.value.input,
        split: 'fit' as const,
        reference: 'every' as const,
        verseNumbers: true,
        translationName: false,
      },
    };
    const labelsOf = async () => {
      const {feed, content, current} = await setUp(undefined, {lookup});
      content.storedService.mockReturnValue({
        ...current,
        data: {...current.data, order: [item]},
      });
      await feed.refresh();
      const labels = feed.current()?.tiles[item.id]?.map(tile => tile.label);
      await feed.dispose();
      return labels;
    };
    expect(await labelsOf()).toEqual([
      '\uC6943:16',
      '\uC6943:17',
      '\uC6943:18',
    ]);
  });

  it('discards a superseded saved-passage read and publishes only the latest service content', async () => {
    const request = parseBibleLookupRequest({
      translation: 'sample',
      input: '요한복음 3:16',
    });
    if (!request.ok) throw new Error('Invalid lookup fixture');
    const answer: BibleLookupReply = {
      ...request.value,
      suggestions: [],
      result: {
        ok: true,
        value: {
          translation: request.value.translation,
          ref: request.value.input,
          displayRef: request.value.input,
          verses: [{chapter: 3, verse: 16, text: 'Invented'}],
        },
      },
    };
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    const lookup = vi
      .fn<NonNullable<OpenServiceSources['bible']>['lookup']>()
      .mockReturnValueOnce(
        new Promise(resolve => {
          finish = resolve;
        }),
      );
    const {feed, content, current, push} = await setUp(undefined, {lookup});
    const item = {
      id: createServiceItemId(itemId(60)),
      bible: {
        translation: request.value.translation,
        ref: request.value.input,
        split: 'verse' as const,
        reference: 'every' as const,
        verseNumbers: true,
        translationName: false,
      },
    };
    content.storedService.mockReturnValue({
      ...current,
      data: {...current.data, order: [item]},
    });
    const first = feed.refresh();
    await vi.waitFor(() => expect(lookup).toHaveBeenCalledOnce());
    content.storedService.mockReturnValue({
      ...current,
      data: {...current.data, name: 'Latest selection', order: []},
    });
    const latest = feed.refresh();
    finish(answer);
    await Promise.all([first, latest]);
    expect(feed.current()).toMatchObject({
      name: 'Latest selection',
      rows: [],
      tiles: {},
    });
    expect(push).toHaveBeenCalledOnce();
    await feed.dispose();
  });

  it('drains a refresh queued between flush completion and finalization before either caller resolves', async () => {
    let finish: (value: MediaChoice | null) => void = () => undefined;
    const check = new Promise<MediaChoice | null>(resolve => {
      finish = resolve;
    });
    const backgroundOf = vi.fn<OpenServiceSources['backgroundOf']>(() => check);
    const {feed, content, current, push} = await setUp(backgroundOf);
    const song = parseSong(
      JSON.stringify({...hymnOne(), background: itemId(90)}),
      'song.llsong',
    );
    const latest = parseService(
      JSON.stringify({
        ...current.data,
        name: 'Latest',
        order: [{slides: [], id: itemId(1), song: HYMN_ONE_ID}],
      }),
      'service.llservice',
    );
    if (!song.ok || !latest.ok) throw new Error('Invalid test content');
    content.storedSongs.mockReturnValue(
      new Map([
        [HYMN_ONE_ID, {...song.value, file: 'song.llsong', revision: 1}],
      ]),
    );
    content.storedService.mockReturnValue({
      ...current,
      data: {...current.data, name: 'First'},
    });
    let late = Promise.resolve();
    let lateDone = false;
    push.mockImplementationOnce(() =>
      queueMicrotask(() => {
        content.storedService.mockReturnValue({
          ...current,
          data: latest.value.data,
        });
        late = feed.refresh().then(() => {
          lateDone = true;
        });
      }),
    );
    let firstDone = false;
    const first = feed.refresh().then(() => {
      firstDone = true;
    });
    try {
      await vi.waitFor(() => expect(backgroundOf).toHaveBeenCalledTimes(1));
      expect(firstDone).toBe(false);
      expect(lateDone).toBe(false);
    } finally {
      finish({mediaId: itemId(90), loop: true});
      await Promise.all([first, late]);
      await feed.dispose();
    }
    expect(firstDone).toBe(true);
    expect(lateDone).toBe(true);
    expect(feed.current()).toMatchObject({revision: 3, name: 'Latest'});
    expect(push).toHaveBeenCalledTimes(2);
  });

  it('coalesces refreshes and never publishes a superseded background check', async () => {
    const {content, current, push, report} = await setUp();
    const song = parseSong(
      JSON.stringify({...hymnOne(), background: itemId(90)}),
      'song.llsong',
    );
    const parsed = parseService(
      JSON.stringify(
        service(SUNDAY_ID, '2026-11-01T11:00', [
          {slides: [], id: itemId(1), song: HYMN_ONE_ID},
          {slides: [], id: itemId(2), song: HYMN_ONE_ID},
        ]),
      ),
      'service.llservice',
    );
    if (!song.ok || !parsed.ok) throw new Error('Invalid test content');
    content.storedSongs.mockReturnValue(
      new Map([
        [HYMN_ONE_ID, {...song.value, file: 'song.llsong', revision: 1}],
      ]),
    );
    content.storedService.mockReturnValue({
      ...current,
      data: parsed.value.data,
    });
    let finish: (value: MediaChoice | null) => void = () => undefined;
    const backgroundOf = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<MediaChoice | null>(resolve => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(null);
    const feed = new OpenServiceFeed(
      {serviceId: SUNDAY_ID, labels: [], content, backgroundOf},
      push,
      report,
    );
    const first = feed.refresh();
    content.storedService.mockReturnValue({
      ...current,
      data: {...parsed.value.data, name: 'Latest'},
    });
    const second = feed.refresh();
    finish({mediaId: itemId(90), loop: true});
    await Promise.all([first, second]);

    expect(backgroundOf).toHaveBeenCalledTimes(2);
    expect(feed.current()).toMatchObject({
      revision: 1,
      name: 'Latest',
      rows: [{problem: 'missing-background'}, {problem: 'missing-background'}],
    });
    expect(push).not.toHaveBeenCalled();
    backgroundOf.mockImplementationOnce(
      () =>
        new Promise<MediaChoice | null>(resolve => {
          finish = resolve;
        }),
    );
    const before = feed.current();
    const refreshing = feed.refresh();
    const stopped = feed.dispose();
    let disposed = false;
    const observed = stopped.then(() => {
      disposed = true;
    });
    await Promise.resolve();
    expect(disposed).toBe(false);
    finish({mediaId: itemId(90), loop: true});
    await Promise.all([refreshing, observed]);
    await feed.refresh();
    expect(backgroundOf).toHaveBeenCalledTimes(3);
    expect(feed.current()).toBe(before);
    expect(push).not.toHaveBeenCalled();
  });

  it('keeps its revision and sends nothing when only a file revision changed', async () => {
    const {feed, content, current, push} = await setUp();
    content.storedService.mockReturnValue({...current, revision: 2});

    await feed.refresh();

    expect(feed.current()?.revision).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('advances the shown revision only when the displayed content changed', async () => {
    const {feed, content, current, push} = await setUp();
    content.storedService.mockReturnValue({
      ...current,
      data: {...current.data, name: '새 예배'},
    });

    await feed.refresh();
    await feed.refresh();

    expect(feed.current()).toMatchObject({revision: 2, name: '새 예배'});
    expect(push).toHaveBeenCalledTimes(1);
    content.storedService.mockReturnValue(undefined);
    await feed.refresh();
    expect(feed.current()).toBeNull();
    expect(push).toHaveBeenLastCalledWith(null);
  });

  it('logs a rebuild failure and retains the last good service', async () => {
    const {feed, content, push, report} = await setUp();
    const before = feed.current();
    content.storedSongs.mockImplementation(() => {
      throw new Error('failed to read content');
    });

    await expect(feed.refresh()).resolves.toBeUndefined();

    expect(feed.current()).toBe(before);
    expect(push).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(expect.any(Error));
  });
});
