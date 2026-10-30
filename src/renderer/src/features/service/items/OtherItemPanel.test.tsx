import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {thumbnailUrl} from '@contracts/ipc/media';
import {
  createServiceItemId,
  noticeSetIdSchema,
  screenIdSchema,
  type MediaId,
} from '@core/schema/ids';
import {
  parseSettingsDocument,
  type SettingsDocument,
} from '@core/schema/settingsDocuments';
import type {ServiceItem} from '@core/schema/service';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {
  mediaDocument,
  mediaFixture,
  mediaItem,
} from '@renderer/features/media/mediaTesting';
import {
  INITIAL_ROWS,
  OVERSCAN_ROWS,
} from '@renderer/features/media/VirtualMediaGrid';
import {defaultThumbnailColumns} from '@renderer/ui/sizeClass';
import {fixtureMedia, itemMedia} from './itemFixture';
import {OtherItemPanel} from './OtherItemPanel';
import {useOtherSources} from './useOtherSources';

afterEach(() => {
  delete window.llp;
});

const noticeSet = v.parse(
  noticeSetIdSchema,
  '80000000-0000-4000-8000-000000000001',
);
const itemId = createServiceItemId('50000000-0000-4000-8000-000000000009');

function noticesDocument({
  media = [fixtureMedia.warm, fixtureMedia.dawn],
  revision = 1,
  name = '주보 공지',
}: {
  readonly media?: readonly MediaId[];
  readonly revision?: number;
  readonly name?: string;
} = {}) {
  const parsed = parseSettingsDocument({
    name: 'notices',
    revision,
    access: 'editable',
    value: {
      format: 'llsettings.notices',
      schemaVersion: 1,
      sets: [
        {
          id: noticeSet,
          name,
          media,
          interval: 5,
          loop: true,
          targets: [
            v.parse(screenIdSchema, '90000000-0000-4000-8000-000000000001'),
          ],
        },
      ],
    },
  });
  if (!parsed.ok || parsed.value.name !== 'notices') {
    throw new Error('Invalid notices fixture');
  }
  return parsed.value;
}

function sourcesFixture(
  document: MediaDocument = itemMedia(),
  notices = noticesDocument(),
) {
  const fixture = mediaFixture(document);
  const listeners = new Set<(document: SettingsDocument) => void>();
  const getMedia = vi.fn(() => Promise.resolve(document));
  const getNotices = vi.fn(() => Promise.resolve(notices));
  const api = {
    ...fixture.api,
    media: {...fixture.api.media, get: getMedia},
    settings: {
      ...fixture.api.settings,
      get: getNotices,
      subscribe: (listener: (document: SettingsDocument) => void) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    },
  };
  return {
    ...fixture,
    api,
    getMedia,
    getNotices,
    noticesListeners: listeners,
    pushNotices: (next: SettingsDocument) => {
      for (const listener of listeners) listener(next);
    },
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
  it('shows the images of a 공지 set without a way to change them', async () => {
    show({id: itemId, notice: noticeSet});
    expect(await screen.findByText('주보 공지')).toBeDefined();
    expect(screen.getByText('슬라이드 2개')).toBeDefined();
    const names = screen
      .getAllByRole('option')
      .map(tile => tile.getAttribute('aria-label'));
    expect(names).toEqual(['따뜻한 빛', '새벽 하늘']);
    expect(
      [...document.querySelectorAll('img')].map(image =>
        image.getAttribute('src'),
      ),
    ).toEqual([
      thumbnailUrl(fixtureMedia.warm),
      thumbnailUrl(fixtureMedia.dawn),
    ]);
    expect(document.querySelector('video')).toBeNull();
  });

  it('bounds mounted tiles and cached thumbnails for a large notice set while scrolling', async () => {
    const items = Array.from({length: 1000}, (_, index) =>
      mediaItem(index + 1),
    );
    const fixture = sourcesFixture(
      mediaDocument(items),
      noticesDocument({media: items.map(item => item.id)}),
    );
    show({id: itemId, notice: noticeSet}, fixture);
    await screen.findByRole('option', {name: 'Invented 1'});
    const columns = defaultThumbnailColumns.normal;
    const bound = (INITIAL_ROWS + OVERSCAN_ROWS * 2) * columns;
    expect(screen.getAllByRole('option')).toHaveLength(bound);
    expect(document.querySelectorAll('img')).toHaveLength(bound);
    expect(document.querySelector('video')).toBeNull();
    const first = screen.getByRole('option', {name: 'Invented 1'});
    expect(first.getAttribute('aria-setsize')).toBe('1000');
    const viewport = screen.getByRole('listbox', {name: '주보 공지'})
      .parentElement?.parentElement;
    if (viewport === null || viewport === undefined) {
      throw new Error('Missing viewport');
    }
    fireEvent.scroll(viewport, {target: {scrollTop: 100}});
    await screen.findByRole('option', {name: `Invented ${99 * columns + 1}`});
    expect(screen.queryByRole('option', {name: 'Invented 1'})).toBeNull();
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(bound);
    expect(
      [...document.querySelectorAll('img')].every(image =>
        image.src.startsWith('llp-media://thumbnail/'),
      ),
    ).toBe(true);
  });

  it('moves keyboard focus between visible notice tiles and keeps one Tab stop without selecting', async () => {
    const user = userEvent.setup();
    render(<button>Before</button>);
    const fixture = show({id: itemId, notice: noticeSet});
    render(<button>After</button>);
    const first = await screen.findByRole('option', {name: '따뜻한 빛'});
    const second = screen.getByRole('option', {name: '새벽 하늘'});
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: 'Before'}),
    );
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(second);
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: 'After'}),
    );
    await user.tab({shift: true});
    expect(document.activeElement).toBe(second);
    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(first);
    expect(
      screen
        .getAllByRole('option')
        .every(tile => tile.getAttribute('aria-selected') === 'false'),
    ).toBe(true);
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('moves keyboard focus within and across notice windows while retaining bounded unselected tiles', async () => {
    const user = userEvent.setup();
    const items = Array.from({length: 1000}, (_, index) =>
      mediaItem(index + 1),
    );
    const fixture = show(
      {id: itemId, notice: noticeSet},
      sourcesFixture(
        mediaDocument(items),
        noticesDocument({media: items.map(item => item.id)}),
      ),
    );
    await screen.findByRole('option', {name: 'Invented 1'});
    const viewport = screen.getByRole('listbox', {name: '주보 공지'})
      .parentElement?.parentElement;
    if (viewport === null || viewport === undefined) {
      throw new Error('Missing viewport');
    }
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: INITIAL_ROWS,
    });
    await user.tab();
    const moves = [
      ['{ArrowRight}', 2],
      ['{ArrowDown}', 6],
      ['{ArrowDown}', 10],
      ['{ArrowDown}', 14],
      ['{ArrowDown}', 18],
      ['{ArrowDown}', 22],
      ['{End}', 1000],
      ['{ArrowLeft}', 999],
      ['{Home}', 1],
    ] as const;
    const bound =
      (INITIAL_ROWS + OVERSCAN_ROWS * 2) * defaultThumbnailColumns.normal;
    for (const [key, index] of moves) {
      await user.keyboard(key);
      const target = await screen.findByRole('option', {
        name: `Invented ${index}`,
      });
      expect(document.activeElement).toBe(target);
      expect(target.tabIndex).toBe(0);
      expect(
        screen.getAllByRole('option').filter(tile => tile.tabIndex === 0),
      ).toHaveLength(1);
      expect(target.getAttribute('aria-posinset')).toBe(String(index));
      expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(bound);
      expect(
        screen
          .getAllByRole('option')
          .every(tile => tile.getAttribute('aria-selected') === 'false'),
      ).toBe(true);
    }
    expect(fixture.send).not.toHaveBeenCalled();
  });

  it('follows notice names, membership, media renames, and deletions without remounting', async () => {
    const fixture = show({id: itemId, notice: noticeSet});
    await screen.findByRole('option', {name: '따뜻한 빛'});
    act(() =>
      fixture.pushDocument(
        mediaDocument(
          itemMedia().value.items.map(item => ({...item, name: 'Renamed'})),
          2,
        ),
      ),
    );
    expect(screen.getAllByRole('option', {name: 'Renamed'})).toHaveLength(2);
    act(() =>
      fixture.pushNotices(
        noticesDocument({
          name: 'Updated',
          media: [fixtureMedia.dawn],
          revision: 2,
        }),
      ),
    );
    expect(screen.getByText('Updated')).toBeDefined();
    expect(screen.getByText('슬라이드 1개')).toBeDefined();
    act(() => fixture.pushDocument(mediaDocument([], 3)));
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByText('슬라이드 0개')).toBeDefined();
    const latest = noticesDocument({revision: 3});
    act(() =>
      fixture.pushNotices({...latest, value: {...latest.value, sets: []}}),
    );
    expect(
      screen.getByRole('region', {name: '예배 순서 항목'}).textContent,
    ).toBe('');
  });

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

  it('keeps newer pushes over deferred reads and stale pushes, then releases both feeds', async () => {
    const fixture = sourcesFixture();
    let finishMedia: (document: MediaDocument) => void = () => undefined;
    let finishNotices: (
      document: ReturnType<typeof noticesDocument>,
    ) => void = () => undefined;
    fixture.getMedia.mockReturnValueOnce(
      new Promise(resolve => {
        finishMedia = resolve;
      }),
    );
    fixture.getNotices.mockReturnValueOnce(
      new Promise(resolve => {
        finishNotices = resolve;
      }),
    );
    window.llp = fixture.api;
    const {result, unmount} = renderHook(() => useOtherSources(true));
    const latestMedia = mediaDocument([mediaItem(8)], 3);
    const latestNotices = noticesDocument({name: 'Latest', revision: 3});
    act(() => {
      fixture.pushDocument(latestMedia);
      fixture.pushNotices(latestNotices);
    });
    await act(async () => {
      finishMedia(itemMedia());
      finishNotices(noticesDocument());
    });
    act(() => {
      fixture.pushDocument(mediaDocument([], 2));
      fixture.pushNotices(noticesDocument({revision: 2}));
    });
    expect(result.current.media).toEqual(latestMedia.value.items);
    expect(result.current.notices).toEqual(latestNotices.value.sets);
    expect(fixture.listeners.document.size).toBe(1);
    expect(fixture.noticesListeners.size).toBe(1);
    unmount();
    expect(fixture.listeners.document.size).toBe(0);
    expect(fixture.noticesListeners.size).toBe(0);
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
    await waitFor(() => expect(result.current.notices).toHaveLength(1));
    expect(fixture.listeners.document.size).toBe(1);
    expect(fixture.noticesListeners.size).toBe(1);
    rerender({open: false});
    expect(fixture.listeners.document.size).toBe(0);
    expect(fixture.noticesListeners.size).toBe(0);
    await act(async () => finish(mediaDocument([mediaItem(9)], 9)));
    expect(result.current.media).toHaveLength(0);
    rerender({open: true});
    await waitFor(() => expect(result.current.media).toHaveLength(3));
    unmount();
    expect(fixture.listeners.document.size).toBe(0);
    expect(fixture.noticesListeners.size).toBe(0);
  });

  it('shows the name of a media item in the header', async () => {
    show({id: itemId, media: fixtureMedia.dawn});
    expect(await screen.findByText('새벽 하늘')).toBeDefined();
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
