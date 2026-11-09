import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState} from '@core/live/state';
import {SUNDAY_NOTICE_PICTURE_ID} from '@core/themes/sundayNotice';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {defaultPreferences} from '@core/schema/preferences';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {
  applyService,
  openItem,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {
  sampleService,
  seedSampleService,
} from '@fixtures/renderer/session/sampleService';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import userEvent from '@testing-library/user-event';
import {
  itemFixture,
  fixtureItems,
  fixtureServiceId,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {newSlidesItem} from '@core/services/slidesEdits';

const sent: LiveCommand[] = [];

function installApi(): void {
  window.llp = mockLlpApi({
    live: {
      get: async () => emptyLiveState(),
      send: command => sent.push(command),
      subscribe: () => () => undefined,
    },
  });
}

function setLiveSlide(itemId: string, position: number): void {
  const base = emptyLiveState();
  useLive.setState({
    state: {
      ...base,
      layers: {
        ...base.layers,
        slide: {itemId, position, label: null, lines: ['x']},
      },
    },
  });
}

beforeEach(() => {
  sent.length = 0;
  installApi();
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

const iconRenders = vi.hoisted((): string[] => []);

vi.mock('@renderer/ui/Icon', () => ({
  Icon: ({name}: {readonly name: string}): null => {
    iconRenders.push(name);
    return null;
  },
}));

describe('ServiceOrderList', () => {
  it.each(['blank', 'ad'] as const)(
    'opens the inline %s editor on double-click and Enter',
    async form => {
      const fixture = itemFixture();
      const item = newSlidesItem(form, fixtureItems.plain);
      fixture.pushService({
        ...fixture.service(),
        service: {...fixture.service().service, order: [item]},
      });
      window.llp = fixture.api;
      const open = vi.spyOn(fixture.api.slidesEditor, 'open');
      useShow.setState({
        serviceId: fixtureServiceId,
        readOnly: false,
        rows: [{kind: 'slides', form, id: item.id, title: 'Slides'}],
        tiles: {},
      });
      render(<ServiceOrderList workspace="prep" />);
      const row = screen.getByRole('option', {name: 'Slides'});
      fireEvent.doubleClick(row);
      await waitFor(() =>
        expect(open).toHaveBeenCalledExactlyOnceWith({
          serviceId: fixtureServiceId,
          itemId: item.id,
        }),
      );
      fireEvent.keyDown(row, {key: 'Enter', code: 'Enter'});
      await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
      expect(sent).toHaveLength(0);
    },
  );
  it('renames a slides item in place through its row menu', async () => {
    const fixture = itemFixture();
    const item = newSlidesItem('ad', fixtureItems.plain);
    fixture.pushService({
      ...fixture.service(),
      service: {...fixture.service().service, order: [item]},
    });
    window.llp = fixture.api;
    useShow.setState({
      serviceId: fixtureServiceId,
      readOnly: false,
      rows: [{kind: 'slides', form: 'ad', id: item.id, title: '광고'}],
      tiles: {},
    });
    render(<ServiceOrderList workspace="prep" />);
    fireEvent.contextMenu(screen.getByRole('option', {name: '광고'}));
    await userEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const field = await screen.findByRole('textbox', {name: '광고 이름'});
    fireEvent.change(field, {target: {value: '이번 주 광고'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() =>
      expect(fixture.service().service.order[0]).toMatchObject({
        slides: {name: '이번 주 광고'},
      }),
    );
    expect(sent).toHaveLength(0);
  });
  it('shows a missing Bible warning without sending output when selected', () => {
    useShow.setState({
      rows: [
        {
          kind: 'bible',
          id: 'missing-passage',
          title: '시편 1:1',
          problem: 'missing-bible',
        },
      ],
      tiles: {},
    });
    render(<ServiceOrderList />);
    const row = screen.getByRole('option', {name: /시편 1:1/u});
    fireEvent.click(row);
    expect(useShow.getState().openItemId).toBe('missing-passage');
    expect(within(row).getByLabelText('성경 구절 없음')).toBeTruthy();
    expect(sent).toHaveLength(0);
  });

  it('names a missing background and opens its existing edit path, leaving empty and builtin backgrounds clean', () => {
    const onOpenPrep = vi.fn();
    useShow.setState({
      rows: [
        {kind: 'song', id: 'none', title: 'No background'},
        {
          kind: 'song',
          id: 'builtin',
          title: 'Built-in',
          background: {mediaId: SUNDAY_NOTICE_PICTURE_ID, loop: false},
        },
        {
          kind: 'song',
          id: 'missing',
          title: 'Missing',
          problem: 'missing-background',
          missingBackgroundName: 'Warm light',
        },
      ],
      tiles: {},
    });
    render(<ServiceOrderList onOpenPrep={onOpenPrep} />);
    expect(
      screen.getAllByRole('img', {name: /배경 파일을 찾을 수 없습니다/u}),
    ).toHaveLength(1);
    expect(screen.getByRole('img', {name: /Warm light/u})).toBeDefined();
    fireEvent.click(screen.getByRole('button', {name: '배경 바꾸기'}));
    expect(onOpenPrep).toHaveBeenCalledWith('missing', undefined, 'settings');
    expect(useShow.getState().openItemId).toBe('missing');
    expect(sent).toHaveLength(0);
  });

  it('makes items selectable without outputting, and sections do nothing in 진행', () => {
    render(<ServiceOrderList />);
    expect(screen.queryByRole('option', {name: '찬양'})).toBeNull();
    const label = screen.getByText('찬양');
    fireEvent.click(label);
    fireEvent.doubleClick(label);
    expect(useShow.getState().openItemId).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    const item = screen.getByRole('option', {name: /아침이 밝아 오네/});
    fireEvent.click(item);
    expect(useShow.getState().openItemId).toBe('song-morning');
    expect(item.getAttribute('aria-selected')).toBe('true');
    expect(sent).toHaveLength(0);
  });

  it('keeps sections as selectable rows in 준비', () => {
    render(<ServiceOrderList workspace="prep" />);
    const section = screen.getByRole('option', {name: '찬양'});
    fireEvent.click(section);
    expect(useShow.getState().openItemId).toBe('praise');
    expect(section.getAttribute('aria-selected')).toBe('true');
    expect(sent).toHaveLength(0);
  });

  it('explains the problem of a row in its tooltip, and only then', () => {
    applyService({
      ...sampleService,
      revision: 2,
      rows: [
        {kind: 'song', id: 'ok', title: '정상'},
        {kind: 'song', id: 'gone', title: '없는 곡', problem: 'missing-song'},
        {kind: 'unknown', id: 'new', title: '새 항목', problem: 'unknown-kind'},
      ],
    });
    render(<ServiceOrderList />);
    const marks = screen.getAllByRole('img').map(mark => mark.ariaLabel);
    expect(marks).toEqual(['곡 파일을 찾을 수 없습니다', '아직 없는 기능']);
    expect(
      within(screen.getByRole('option', {name: /정상/})).queryByRole('img'),
    ).toBeNull();
    expect(
      within(screen.getByRole('option', {name: /없는 곡/})).getByRole('img'),
    ).toBeTruthy();
  });

  it('shows no rows while no service is open', () => {
    applyService(null);
    render(<ServiceOrderList />);
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows the LIVE badge on the item of the live 장 only', () => {
    setLiveSlide('song-river', 1);
    render(<ServiceOrderList />);
    const live = screen.getByRole('option', {name: /맑은 시냇물/});
    expect(live.textContent).toContain('LIVE');
    expect(screen.getAllByText('LIVE')).toHaveLength(1);
  });

  describe('the LIVE badge of a media item', () => {
    function setOther(
      layers: Partial<ReturnType<typeof emptyLiveState>['layers']>,
      started: string | null,
    ): void {
      const base = emptyLiveState();
      useShow.setState({
        tiles: {
          ...useShow.getState().tiles,
          countdown: [
            {
              label: null,
              labelColor: 'none',
              lines: ['x'],
              media: {mediaId: 'countdown-video', loop: true},
            },
          ],
        },
      });
      useLive.setState({
        state: {...base, layers: {...base.layers, ...layers}},
        lastStartedItemId: started,
      });
    }
    const mediaLayer = (mediaId: string) => ({
      mediaId,
      loop: true,
      startedAt: 0,
    });

    it('marks a media item while its media is out', () => {
      setOther({media: mediaLayer('countdown-video')}, 'countdown');
      render(<ServiceOrderList />);
      expect(
        screen.getByRole('option', {name: /예배 전 카운트다운/}).textContent,
      ).toContain('LIVE');
      expect(screen.getAllByText('LIVE')).toHaveLength(1);
    });

    it('marks nothing once the media is cleared or another media is out', () => {
      setOther({}, 'countdown');
      const view = render(<ServiceOrderList />);
      expect(screen.queryAllByText('LIVE')).toHaveLength(0);
      setOther({media: mediaLayer('other-video')}, 'countdown');
      view.rerender(<ServiceOrderList />);
      expect(screen.queryAllByText('LIVE')).toHaveLength(0);
    });

    it('keeps the mark of a song with a slide ahead of a media item', () => {
      setOther({media: mediaLayer('countdown-video')}, 'countdown');
      setLiveSlide('song-river', 0);
      useLive.setState(view => ({
        state: view.state && {
          ...view.state,
          layers: {...view.state.layers, media: mediaLayer('countdown-video')},
        },
      }));
      render(<ServiceOrderList />);
      expect(screen.getAllByText('LIVE')).toHaveLength(1);
      expect(
        screen.getByRole('option', {name: /맑은 시냇물/}).textContent,
      ).toContain('LIVE');
    });
  });

  it('redraws only the rows whose open state changed', () => {
    openItem('song-morning');
    render(<ServiceOrderList />);
    iconRenders.length = 0;
    act(() => openItem('psalm-23'));
    expect(iconRenders.toSorted()).toEqual(['book', 'song']);
  });

  it('redraws only the rows whose live mark changed', () => {
    setLiveSlide('song-morning', 0);
    render(<ServiceOrderList />);
    iconRenders.length = 0;
    act(() => setLiveSlide('psalm-23', 0));
    expect(iconRenders.toSorted()).toEqual(['book', 'song']);
  });

  it('does not take focus when the selection changes from elsewhere', () => {
    render(<ServiceOrderList />);
    openItem('song-river');
    expect(document.activeElement).toBe(document.body);
  });

  it('moves between item rows with the arrow keys, Home, and End, skipping sections', () => {
    render(<ServiceOrderList />);
    const press = (key: string): void => {
      fireEvent.keyDown(document.activeElement ?? document.body, {key});
    };
    screen.getByRole('option', {name: /아침이 밝아 오네/}).focus();
    for (const [key, id, name] of [
      ['Home', 'countdown', '예배 전 카운트다운'],
      ['ArrowDown', 'song-morning', '아침이 밝아 오네'],
      ['ArrowDown', 'song-river', '맑은 시냇물'],
      ['ArrowUp', 'song-morning', '아침이 밝아 오네'],
      ['Home', 'countdown', '예배 전 카운트다운'],
      ['End', 'psalm-23', '시편 23편 1절부터 6절'],
    ] as const) {
      press(key);
      expect(useShow.getState().openItemId).toBe(id);
      expect(document.activeElement).toBe(screen.getByRole('option', {name}));
    }
    expect(sent).toHaveLength(0);
  });

  it.each([
    {
      end: 'last',
      itemId: 'song-river',
      title: /맑은 시냇물/,
      keys: ['ArrowDown', 'End'],
    },
    {
      end: 'first',
      itemId: 'song-morning',
      title: /아침이 밝아 오네/,
      keys: ['ArrowUp', 'Home'],
    },
  ])(
    'keeps the tile selection when a key stays on the $end row',
    ({itemId, title, keys}) => {
      applyService({
        ...sampleService,
        revision: 2,
        rows: sampleService.rows.filter(row => row.kind === 'song'),
      });
      openItem(itemId);
      selectTile(2);
      render(<ServiceOrderList />);
      const row = screen.getByRole('option', {name: title});
      row.focus();
      for (const key of keys) fireEvent.keyDown(row, {key});
      expect(useShow.getState()).toMatchObject({
        openItemId: itemId,
        selectedTile: 2,
      });
    },
  );
});

describe('ServiceOrderList progress', () => {
  function dimmingSettings() {
    const listeners = new Set<(document: SettingsDocument) => void>();
    let revision = 1;
    const settings = (dimPastItems: boolean): SettingsDocument => ({
      name: 'preferences',
      access: 'editable',
      revision: revision++,
      value: {
        ...defaultPreferences,
        show: {...defaultPreferences.show, dimPastItems},
      },
    });
    window.llp = mockLlpApi({
      settings: {
        get: async () => settings(true),
        subscribe: listener => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
    });
    return (enabled: boolean) => {
      const document = settings(enabled);
      for (const listener of listeners) listener(document);
    };
  }

  function stateAt(slide: string | null, media: string | null): void {
    const base = emptyLiveState();
    useLive.setState({
      state: {
        ...base,
        layers: {
          ...base.layers,
          slide:
            slide === null
              ? null
              : {itemId: slide, position: 0, label: null, lines: ['Lyrics']},
          media:
            media === null
              ? null
              : {
                  itemId: media,
                  mediaId: 'shared-background',
                  loop: true,
                  startedAt: 0,
                },
        },
      },
      lastStartedItemId: null,
    });
  }

  it.each(['show', 'prep'] as const)(
    'dims every kind and section by position in %s, then restores rows when moving back or disabling',
    async workspace => {
      const update = dimmingSettings();
      applyService({
        ...sampleService,
        rows: [
          {id: 'section', kind: 'header', title: 'Earlier section'},
          {id: 'lyrics', kind: 'song', title: 'Lyrics without background'},
          {
            id: 'media',
            kind: 'media',
            title: 'Background reused by the current song',
          },
          {
            id: 'background',
            kind: 'slides',
            form: 'blank',
            title: 'Background only',
          },
          {id: 'bible', kind: 'bible', title: 'Bible'},
          {id: 'unknown', kind: 'unknown', title: 'Unknown item'},
          {id: 'current', kind: 'song', title: 'Current song'},
          {id: 'future-section', kind: 'header', title: 'Later section'},
          {id: 'future', kind: 'song', title: 'Later song'},
        ],
      });
      stateAt('current', 'media');
      render(<ServiceOrderList workspace={workspace} />);
      const past = () =>
        [
          'Lyrics without background',
          'Background reused by the current song',
          'Background only',
          'Bible',
          'Unknown item',
        ].map(name => screen.getByRole('option', {name}));
      await waitFor(() =>
        expect(
          past().every(row => row.dataset['state']?.includes('done')),
        ).toBe(true),
      );
      const section = screen
        .getByText('Earlier section')
        .closest('[data-state]');
      expect(section?.getAttribute('data-state')).toBe('done');
      expect(
        screen.getByRole('option', {name: 'Current song'}).dataset['state'],
      ).toBe('live');
      expect(
        screen.getByText('Later section').closest('[data-state]'),
      ).toBeNull();
      expect(
        screen.getByRole('option', {name: 'Later song'}).dataset['state'],
      ).toBeUndefined();
      act(() => stateAt('lyrics', 'media'));
      expect(past().every(row => !row.dataset['state']?.includes('done'))).toBe(
        true,
      );
      act(() => stateAt(null, 'background'));
      expect(
        screen.getByRole('option', {name: 'Background only'}).dataset['state'],
      ).toBe('live');
      expect(
        screen.getByRole('option', {name: 'Lyrics without background'}).dataset[
          'state'
        ],
      ).toBe('done');
      expect(
        screen.getByRole('option', {name: 'Bible'}).dataset['state'],
      ).toBeUndefined();
      act(() => update(false));
      expect(past().every(row => !row.dataset['state']?.includes('done'))).toBe(
        true,
      );
      act(() => update(true));
      expect(
        screen.getByRole('option', {name: 'Lyrics without background'}).dataset[
          'state'
        ],
      ).toBe('done');
      act(() => stateAt(null, null));
      expect(past().every(row => !row.dataset['state']?.includes('done'))).toBe(
        true,
      );
      expect(
        screen.getByText('Earlier section').closest('[data-state]'),
      ).toBeNull();
      act(() => stateAt('outside-this-service', 'media'));
      expect(past().every(row => !row.dataset['state']?.includes('done'))).toBe(
        true,
      );
    },
  );

  function live(slideItemId: string | null): void {
    const base = emptyLiveState();
    useLive.setState({
      state: {
        ...base,
        layers: {
          ...base.layers,
          slide:
            slideItemId === null
              ? null
              : {itemId: slideItemId, position: 0, label: null, lines: ['x']},
        },
      },
      lastStartedItemId: 'psalm-23',
    });
  }

  function row(title: RegExp): HTMLElement {
    return screen.getByRole('option', {name: title});
  }

  it('keeps past rows normal while live changes, clears, and moves in the order', () => {
    live('psalm-23');
    render(<ServiceOrderList />);
    expect(row(/아침이 밝아 오네/).dataset['state']).toBeUndefined();
    expect(row(/맑은 시냇물/).dataset['state']).toBeUndefined();
    expect(row(/시편 23편/).dataset['state']).toContain('live');

    act(() => live(null));
    expect(row(/아침이 밝아 오네/).dataset['state']).toBeUndefined();
    expect(row(/시편 23편/).dataset['state']).toBeUndefined();
    act(() =>
      applyService({
        ...sampleService,
        revision: 2,
        rows: [...sampleService.rows].reverse(),
      }),
    );

    expect(row(/아침이 밝아 오네/).dataset['state']).toBeUndefined();
  });
});
