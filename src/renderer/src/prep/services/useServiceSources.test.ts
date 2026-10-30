import {act, renderHook, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {
  TemplateDocument,
  TemplateEntry,
} from '@shared/schema/contentDocuments';
import {createTemplateId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  EMPTY_SOURCE,
  sourceKey,
  useSourceDocument,
  useSourceLists,
  type ServiceSource,
} from './useServiceSources';
import {
  ids,
  librarySongs,
  pastDocument,
  serviceEntries,
  templateDocument,
  templateEntries,
  titles,
} from './testing';

const template: ServiceSource = {kind: 'template', id: ids.template};
const past: ServiceSource = {kind: 'service', id: ids.past};

describe('useSourceLists', () => {
  it('reads the 템플릿, the services, and the song titles', async () => {
    const api = fakeLlpApi({
      templates: {list: () => Promise.resolve(templateEntries)},
      services: {list: () => Promise.resolve(serviceEntries)},
      songs: {list: () => Promise.resolve(librarySongs)},
    });
    const {result} = renderHook(() => useSourceLists(api));
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.templates).toBe(templateEntries);
    expect(result.current.services).toBe(serviceEntries);
    expect(result.current.songTitles.get(ids.firstSong)).toBe(titles.first);
  });

  it('keeps the lists that answered when one read fails, and retries only that one', async () => {
    const write = vi.fn();
    const templatesList = vi.fn(() => Promise.resolve(templateEntries));
    const songsList = vi
      .fn<() => Promise<typeof librarySongs>>()
      .mockRejectedValueOnce(new Error('Read failed'))
      .mockResolvedValue(librarySongs);
    const api = fakeLlpApi({
      templates: {list: templatesList},
      services: {list: () => Promise.resolve(serviceEntries)},
      songs: {list: songsList},
      log: {write},
    });
    const {result} = renderHook(() => useSourceLists(api));
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.templates).toBe(templateEntries);
    expect(result.current.services).toBe(serviceEntries);
    expect(result.current.songTitles.size).toBe(0);
    expect(result.current.failed).toBe(true);
    expect(write).toHaveBeenCalledWith({
      level: 'error',
      message: 'Could not read the song titles',
      detail: 'Read failed',
    });
    act(() => result.current.retry());
    expect(result.current.ready).toBe(true);
    await waitFor(() => expect(result.current.failed).toBe(false));
    expect(result.current.songTitles.get(ids.firstSong)).toBe(titles.first);
    expect(songsList).toHaveBeenCalledTimes(2);
    expect(templatesList).toHaveBeenCalledTimes(1);
  });

  it('follows list changes and keeps a pushed list over a late read', async () => {
    const saved: TemplateEntry = {
      id: createTemplateId('30000000-0000-4000-8000-000000000002'),
      name: '저녁 예배',
      access: 'editable',
    };
    let push: (entries: readonly TemplateEntry[]) => void = () => undefined;
    let answer: (entries: readonly TemplateEntry[]) => void = () => undefined;
    const stop = vi.fn();
    const api = fakeLlpApi({
      templates: {
        list: () =>
          new Promise(resolve => {
            answer = resolve;
          }),
        subscribeList: listener => {
          push = listener;
          return stop;
        },
      },
      services: {list: () => Promise.resolve(serviceEntries)},
    });
    const {result, unmount} = renderHook(() => useSourceLists(api));
    act(() => push([...templateEntries, saved]));
    await act(async () => {
      answer(templateEntries);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.templates).toEqual([...templateEntries, saved]);
    act(() => push([saved]));
    expect(result.current.templates).toEqual([saved]);
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});

describe('useSourceDocument', () => {
  const api = fakeLlpApi({
    templates: {get: () => Promise.resolve(templateDocument)},
    services: {get: () => Promise.resolve(pastDocument)},
  });

  it('reads a 템플릿 with its name, time, and items', async () => {
    const {result} = renderHook(() => useSourceDocument(api, template));
    expect(result.current.document).toBeNull();
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(result.current.document).toMatchObject({
      source: template,
      name: '주일 예배',
      time: '11:00',
      order: templateDocument.template.order,
    });
    expect(result.current.missing).toBe(false);
  });

  it('takes a past service time from its date', async () => {
    const {result} = renderHook(() => useSourceDocument(api, past));
    await waitFor(() => expect(result.current.document?.time).toBe('09:30'));
    expect(result.current.document?.name).toBe('지난 주일 예배');
  });

  it('gives 빈 예배 no name and no items, and waits without a source', async () => {
    const empty = renderHook(() => useSourceDocument(api, EMPTY_SOURCE));
    await waitFor(() =>
      expect(empty.result.current.document).toEqual({
        source: EMPTY_SOURCE,
        name: '',
        time: undefined,
        order: [],
      }),
    );
    const none = renderHook(() => useSourceDocument(api, null));
    expect(none.result.current).toEqual({document: null, missing: false});
  });

  it('says a deleted source is missing', async () => {
    const gone = fakeLlpApi({templates: {get: () => Promise.resolve(null)}});
    const {result} = renderHook(() => useSourceDocument(gone, template));
    await waitFor(() => expect(result.current.missing).toBe(true));
    expect(result.current.document).toBeNull();
  });

  it('keeps the later choice when an earlier read answers last', async () => {
    let answer: (document: TemplateDocument) => void = () => undefined;
    const slow = fakeLlpApi({
      templates: {
        get: () =>
          new Promise(resolve => {
            answer = resolve;
          }),
      },
      services: {get: () => Promise.resolve(pastDocument)},
    });
    const {result, rerender} = renderHook<
      ReturnType<typeof useSourceDocument>,
      {readonly source: ServiceSource}
    >(({source}) => useSourceDocument(slow, source), {
      initialProps: {source: template},
    });
    rerender({source: past});
    await waitFor(() =>
      expect(result.current.document?.name).toBe('지난 주일 예배'),
    );
    answer(templateDocument);
    await Promise.resolve();
    expect(result.current.document?.source).toBe(past);
  });

  it('shows nothing for A, B, then A again until the new read of A answers', async () => {
    const reads: Array<(document: TemplateDocument | null) => void> = [];
    const deferred = fakeLlpApi({
      templates: {
        get: () =>
          new Promise(resolve => {
            reads.push(resolve);
          }),
      },
      services: {get: () => new Promise(() => undefined)},
    });
    const {result, rerender} = renderHook<
      ReturnType<typeof useSourceDocument>,
      {readonly source: ServiceSource}
    >(({source}) => useSourceDocument(deferred, source), {
      initialProps: {source: template},
    });
    await act(async () => {
      reads[0]?.(templateDocument);
      await Promise.resolve();
    });
    expect(result.current.document?.name).toBe('주일 예배');
    rerender({source: past});
    rerender({source: template});
    expect(result.current).toEqual({document: null, missing: false});
    await act(async () => {
      reads[1]?.(null);
      await Promise.resolve();
    });
    expect(result.current).toEqual({document: null, missing: true});
  });

  it('names each source by its kind and id', () => {
    expect(sourceKey(EMPTY_SOURCE)).toBe('empty');
    expect(sourceKey(template)).toBe(`template:${ids.template}`);
  });
});
