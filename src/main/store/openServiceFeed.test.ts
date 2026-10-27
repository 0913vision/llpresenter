import {describe, expect, it, vi} from 'vitest';
import {parseService} from '@shared/schema/service';
import {parseSong} from '@shared/schema/song';
import type {MediaChoice} from '@shared/live';
import type {OpenServiceSources} from './openServiceFeed';
import {OpenServiceFeed} from './openServiceFeed';
import type {StoredDocument} from './documents';
import {service, SUNDAY_ID, HYMN_ONE_ID, hymnOne, itemId} from './testFiles';
import {
  parseBibleLookupRequest,
  type BibleLookupReply,
} from '@shared/schema/bibleLookup';
import {createServiceItemId} from '@shared/schema/ids';

async function setUp(
  backgroundOf: OpenServiceSources['backgroundOf'] = async () => null,
  bible?: OpenServiceSources['bible'],
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
    },
    push,
    report,
  );
  await feed.refresh();
  push.mockClear();
  return {feed, content, current, push, report};
}

describe('OpenServiceFeed', () => {
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
        order: [{id: itemId(1), song: HYMN_ONE_ID}],
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
          {id: itemId(1), song: HYMN_ONE_ID},
          {id: itemId(2), song: HYMN_ONE_ID},
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
