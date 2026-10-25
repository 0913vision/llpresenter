import {describe, expect, it, vi} from 'vitest';
import {parseService} from '@shared/schema/service';
import type {OpenServiceSources} from './openServiceFeed';
import {OpenServiceFeed} from './openServiceFeed';
import type {StoredDocument} from './documents';
import {service, SUNDAY_ID} from './testFiles';

function setUp() {
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
    {serviceId: SUNDAY_ID, labels: [], content},
    push,
    report,
  );
  return {feed, content, current, push, report};
}

describe('OpenServiceFeed', () => {
  it('keeps its revision and sends nothing when only a file revision changed', () => {
    const {feed, content, current, push} = setUp();
    content.storedService.mockReturnValue({...current, revision: 2});

    feed.refresh();

    expect(feed.current()?.revision).toBe(1);
    expect(push).not.toHaveBeenCalled();
  });

  it('advances the shown revision only when the displayed content changed', () => {
    const {feed, content, current, push} = setUp();
    content.storedService.mockReturnValue({
      ...current,
      data: {...current.data, name: '새 예배'},
    });

    feed.refresh();
    feed.refresh();

    expect(feed.current()).toMatchObject({revision: 2, name: '새 예배'});
    expect(push).toHaveBeenCalledTimes(1);
    content.storedService.mockReturnValue(undefined);
    feed.refresh();
    expect(feed.current()).toBeNull();
    expect(push).toHaveBeenLastCalledWith(null);
  });

  it('logs a rebuild failure and retains the last good service', () => {
    const {feed, content, push, report} = setUp();
    const before = feed.current();
    content.storedSongs.mockImplementation(() => {
      throw new Error('failed to read content');
    });

    expect(() => feed.refresh()).not.toThrow();

    expect(feed.current()).toBe(before);
    expect(push).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledWith(expect.any(Error));
  });
});
