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

  it('makes sections and items selectable without outputting a section', () => {
    render(<ServiceOrderList />);
    const section = screen.getByRole('option', {name: '찬양'});
    fireEvent.click(section);
    expect(useShow.getState().openItemId).toBe('praise');
    expect(section.getAttribute('aria-selected')).toBe('true');
    expect(sent).toHaveLength(0);
    expect(screen.getByRole('option', {name: /아침이 밝아 오네/})).toBeTruthy();
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

  it('moves between rows with the arrow keys, Home, and End', () => {
    render(<ServiceOrderList />);
    const press = (key: string): void => {
      fireEvent.keyDown(document.activeElement ?? document.body, {key});
    };
    screen.getByRole('option', {name: /아침이 밝아 오네/}).focus();
    for (const [key, id, name] of [
      ['Home', 'before', '예배 전'],
      ['ArrowDown', 'countdown', '예배 전 카운트다운'],
      ['ArrowDown', 'praise', '찬양'],
      ['ArrowDown', 'song-morning', '아침이 밝아 오네'],
      ['ArrowUp', 'praise', '찬양'],
      ['Home', 'before', '예배 전'],
      ['End', 'closing', '마무리'],
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
      startedItemIds: new Set(['song-morning', 'psalm-23']),
    });
  }

  function row(title: RegExp): HTMLElement {
    return screen.getByRole('option', {name: title});
  }

  it('dims only started items above the current item, follows reorder, and keeps progress through clear', () => {
    live('psalm-23');
    render(<ServiceOrderList />);
    expect(row(/아침이 밝아 오네/).dataset['state']).toContain('done');
    expect(row(/맑은 시냇물/).dataset['state']).toBeUndefined();
    expect(row(/시편 23편/).dataset['state']).toContain('live');

    act(() => live(null));
    expect(row(/아침이 밝아 오네/).dataset['state']).toContain('done');
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
