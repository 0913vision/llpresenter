import {describe, expect, it, vi} from 'vitest';
import {parseService} from '@shared/schema/service';
import {parseSong} from '@shared/schema/song';
import type {MediaChoice} from '@shared/live';
import type {OpenServiceSources} from './openServiceFeed';
import {OpenServiceFeed} from './openServiceFeed';
import type {StoredDocument} from './documents';
import {service, SUNDAY_ID, HYMN_ONE_ID, hymnOne, itemId} from './testFiles';

async function setUp() {
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
    {serviceId: SUNDAY_ID, labels: [], content, backgroundOf: async () => null},
    push,
    report,
  );
  await feed.refresh();
  push.mockClear();
  return {feed, content, current, push, report};
}

describe('OpenServiceFeed', () => {
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
