import {fixtureMedia, itemMedia} from '@fixtures/core/mediaList';
import {act, render, renderHook, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import type {MediaDocument} from '@core/schema/mediaEdit';
import type {MissingMedia} from '@core/schema/mediaFiles';
import {
  mediaDocument,
  mediaFixture,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';
import {OtherItemPanel} from '@renderer/features/service/items/OtherItemPanel';
import {useOtherSources} from '@renderer/features/service/items/useOtherSources';
import {otherItemEntries} from '@renderer/features/service/items/quickAddItems';

afterEach(() => {
  delete window.llp;
});
const itemId = createServiceItemId('50000000-0000-4000-8000-000000000009');

function sourcesFixture(document: MediaDocument = itemMedia()) {
  const fixture = mediaFixture(document);
  const getMedia = vi.fn(() => Promise.resolve(document));
  return {
    ...fixture,
    api: {...fixture.api, media: {...fixture.api.media, get: getMedia}},
    getMedia,
  };
}

function show(item: ServiceItem | null, fixture = sourcesFixture()) {
  window.llp = fixture.api;
  return {
    ...fixture,
    ...render(<OtherItemPanel item={item} sizeClass="normal" />),
  };
}

describe('the center panel of other item kinds', () => {
  it('updates and clears a mounted media header when its item changes or disappears', async () => {
    const fixture = show({id: itemId, media: fixtureMedia.dawn});
    await screen.findByText('새벽 하늘');
    act(() =>
      fixture.pushDocument(
        mediaDocument(
          [
            {
              ...mediaItem(2),
              id: fixtureMedia.dawn,
              name: 'Renamed',
            },
          ],
          2,
        ),
      ),
    );
    expect(screen.getByText('Renamed')).toBeDefined();
    act(() => fixture.pushDocument(mediaDocument([], 3)));
    expect(screen.queryByText('Renamed')).toBeNull();
  });

  it('keeps newer pushes over deferred reads and stale pushes, then releases the feed', async () => {
    const fixture = sourcesFixture();
    let finishMedia: (document: MediaDocument) => void = () => undefined;
    fixture.getMedia.mockReturnValueOnce(
      new Promise(resolve => {
        finishMedia = resolve;
      }),
    );
    window.llp = fixture.api;
    const {result, unmount} = renderHook(() => useOtherSources(true));
    const latestMedia = mediaDocument([mediaItem(8)], 3);
    act(() => {
      fixture.pushDocument(latestMedia);
    });
    await act(async () => {
      finishMedia(itemMedia());
    });
    act(() => {
      fixture.pushDocument(mediaDocument([], 2));
    });
    expect(result.current.media).toEqual(latestMedia.value.items);
    expect(fixture.listeners.document.size).toBe(1);
    unmount();
    expect(fixture.listeners.document.size).toBe(0);
  });

  it('subscribes only while open and ignores late responses after closing', async () => {
    const fixture = sourcesFixture();
    let finish: (document: MediaDocument) => void = () => undefined;
    fixture.getMedia.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    window.llp = fixture.api;
    const {result, rerender, unmount} = renderHook(
      ({open}) => useOtherSources(open),
      {initialProps: {open: false}},
    );
    expect(fixture.getMedia).not.toHaveBeenCalled();
    expect(fixture.listeners.document.size).toBe(0);
    rerender({open: true});
    expect(fixture.listeners.document.size).toBe(1);
    rerender({open: false});
    expect(fixture.listeners.document.size).toBe(0);
    await act(async () => finish(mediaDocument([mediaItem(9)], 9)));
    expect(result.current.media).toHaveLength(0);
    rerender({open: true});
    await waitFor(() => expect(result.current.media).toHaveLength(3));
    unmount();
    expect(fixture.listeners.document.size).toBe(0);
  });

  it('keeps missing-file pushes newer than the initial read and releases them', async () => {
    const fixture = sourcesFixture();
    let finish: (ids: MissingMedia) => void = () => undefined;
    fixture.missing.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    window.llp = fixture.api;
    const {result, unmount} = renderHook(() => useOtherSources(true));
    expect(result.current.mediaReady).toBe(false);
    act(() => fixture.pushMissing([fixtureMedia.dawn]));
    await act(async () => finish([]));
    expect(result.current.mediaReady).toBe(true);
    expect(result.current.missingMedia.has(fixtureMedia.dawn)).toBe(true);
    expect(result.current.canAddMedia(fixtureMedia.dawn)).toBe(false);
    unmount();
    expect(fixture.listeners.missing.size).toBe(0);
  });

  it('ends loading with a reason after a failed check and retries on reopening', async () => {
    const fixture = sourcesFixture();
    fixture.missing.mockRejectedValueOnce(new Error('Unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      window.llp = fixture.api;
      const {result, rerender} = renderHook(({open}) => useOtherSources(open), {
        initialProps: {open: true},
      });
      await waitFor(() =>
        expect(result.current.mediaUnavailableReason).toBe(
          '상태를 확인하지 못했습니다',
        ),
      );
      await waitFor(() =>
        expect(result.current.media.length).toBeGreaterThan(0),
      );
      expect(result.current.mediaReady).toBe(false);
      const menu = otherItemEntries({
        ...result.current,
        onInsert: vi.fn(),
        onBible: vi.fn(),
      });
      const media = menu.find(
        entry => entry.kind === 'item' && entry.id === 'other:media',
      );
      if (media?.kind !== 'item') throw new Error('Missing media menu');
      expect(media.submenu?.[0]).toMatchObject({
        disabled: true,
        title: '상태를 확인하지 못했습니다',
      });
      rerender({open: false});
      rerender({open: true});
      await waitFor(() => expect(result.current.mediaReady).toBe(true));
      expect(result.current.mediaUnavailableReason).toBeUndefined();
      expect(fixture.missing).toHaveBeenCalledTimes(2);
    } finally {
      log.mockRestore();
    }
  });

  it('keeps a newer missing-file push when the initial read rejects', async () => {
    const fixture = sourcesFixture();
    let reject: (reason: Error) => void = () => undefined;
    fixture.missing.mockReturnValueOnce(
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
    );
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      window.llp = fixture.api;
      const {result} = renderHook(() => useOtherSources(true));
      act(() => fixture.pushMissing([fixtureMedia.dawn]));
      await act(async () => reject(new Error('Unavailable')));
      expect(result.current.mediaReady).toBe(true);
      expect(result.current.mediaUnavailableReason).toBeUndefined();
      expect(result.current.canAddMedia(fixtureMedia.dawn)).toBe(false);
    } finally {
      log.mockRestore();
    }
  });

  it('leaves the panel empty for a header, a slot, and no selection', () => {
    show({id: itemId, header: '찬양'});
    const panel = screen.getByRole('region', {name: '예배 순서 항목'});
    expect(panel.textContent).toBe('');
    render(<OtherItemPanel item={null} sizeClass="normal" />);
    expect(
      screen.getAllByRole('region', {name: '예배 순서 항목'}),
    ).toHaveLength(2);
  });
});
