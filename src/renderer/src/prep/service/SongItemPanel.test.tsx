import {act, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {SongEditorStore} from '@renderer/prep/editor';
import {mockMenuRowHeight} from '@renderer/prep/editor/editorTesting';
import {useLive} from '@renderer/state/live';
import {useShow} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {ServiceItemStore} from './serviceItemStore';
import {
  DEFAULT_ORDER_REASON,
  NEWER_FILE_REASON,
  ServiceItemPanel,
} from './SongItemPanel';

afterEach(() => {
  useShow.setState({serviceId: null, openItemId: null});
  useLive.setState({state: null});
  resetTooltips();
});

async function setup(itemId: string = fixtureItems.arranged) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  useShow.setState({serviceId: fixtureServiceId, openItemId: itemId});
  const view = render(
    <ServiceItemPanel items={items} editor={editor} sizeClass="normal" />,
  );
  onTestFinished(async () => {
    view.unmount();
    items.dispose();
    await editor.dispose();
  });
  await screen.findByRole('listbox', {name: '구성 순서'});
  await waitFor(() => expect(editor.getSnapshot().labels).not.toBeNull());
  const panel = screen.getByRole('region', {name: '예배 순서 항목'});
  return {...fixture, editor, items, panel, user: userEvent.setup()};
}

function strip(panel: HTMLElement): HTMLElement {
  return within(panel).getByRole('listbox', {name: '구성 순서'});
}

function chips(panel: HTMLElement): string[] {
  return within(strip(panel))
    .getAllByRole('option')
    .map(chip => chip.textContent);
}

function chip(panel: HTMLElement, index: number): HTMLElement {
  const found = within(strip(panel)).getAllByRole('option')[index];
  if (found === undefined) throw new Error(`No chip ${index}`);
  return found;
}

function selectedThumbnail(panel: HTMLElement): number {
  const thumbnails = within(panel)
    .getAllByRole('option')
    .filter(option => option.closest('[aria-label="구성 순서"]') === null);
  return thumbnails.findIndex(
    option => option.getAttribute('aria-selected') === 'true',
  );
}

describe('service song item panel', () => {
  it('shows the song, the chosen 구성 as chips, and its thumbnails', async () => {
    const {panel, first} = await setup();
    expect(within(panel).getByText(first.song.title)).toBeDefined();
    expect(within(panel).getByText('슬라이드 3개')).toBeDefined();
    expect(
      within(panel).getByRole('button', {name: '구성'}).textContent,
    ).toContain('주일용');
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴']);
  });

  it('selects the matching thumbnail with a chip, and a chip with a thumbnail', async () => {
    const {panel, user, edits} = await setup();
    await user.click(chip(panel, 2));
    expect(selectedThumbnail(panel)).toBe(2);
    await user.keyboard('{Home}');
    expect(selectedThumbnail(panel)).toBe(0);
    expect(edits).toEqual([]);
  });

  it('moves and removes positions of the 구성 in the song with Alt arrows and Delete', async () => {
    const {panel, user, documents, first, items} = await setup();
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    expect(document.activeElement?.textContent).toBe('1절');
    await user.keyboard('{Delete}');
    expect(chips(panel)).toEqual(['후렴', '후렴']);
    await items.getSnapshot().song?.flush();
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([
      {name: '주일용', slides: [2, 2]},
    ]);
  });

  it('undoes and redoes chip edits in the song history with Ctrl Z and Ctrl Y', async () => {
    const {panel, user} = await setup();
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    await user.keyboard('{Control>}z{/Control}');
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴']);
    await user.keyboard('{Control>}y{/Control}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(chips(panel)).toEqual(['후렴', '1절', '후렴']);
  });

  it('appends a chosen 슬라이드 from 슬라이드 넣기', async () => {
    mockMenuRowHeight();
    const {panel, user} = await setup();
    await user.click(
      within(panel).getByRole('button', {name: '슬라이드 넣기'}),
    );
    await user.click(screen.getByRole('menuitem', {name: /^1절 /u}));
    expect(chips(panel)).toEqual(['1절', '후렴', '후렴', '1절']);
    expect(selectedThumbnail(panel)).toBe(3);
  });

  it('keeps the chips of 기본 read-only with the reason in a tooltip', async () => {
    const {panel, user, edits} = await setup(fixtureItems.plain);
    expect(chips(panel)).toEqual(['1절', '후렴']);
    await user.click(chip(panel, 0));
    await user.keyboard('{Alt>}{ArrowRight}{/Alt}{Delete}');
    expect(chips(panel)).toEqual(['1절', '후렴']);
    expect((await hoverForTooltip(chip(panel, 0)))?.textContent).toBe(
      DEFAULT_ORDER_REASON,
    );
    expect(edits).toEqual([]);
  });

  it('chooses 기본 and a 구성 for this item only', async () => {
    mockMenuRowHeight();
    const {panel, user, service} = await setup();
    await user.click(within(panel).getByRole('button', {name: '구성'}));
    await user.click(screen.getByRole('menuitemradio', {name: '기본'}));
    await waitFor(() => expect(chips(panel)).toEqual(['1절', '후렴']));
    expect(service().service.order[1]).not.toHaveProperty('arrangement');
  });

  it('locks the 구성 choice of a read-only service with the reason', async () => {
    const {panel, service, pushService} = await setup();
    act(() => pushService({...service(), revision: 9, access: 'readOnly'}));
    const choice = within(panel).getByRole('button', {name: '구성'});
    expect(choice.getAttribute('aria-disabled')).toBe('true');
    expect((await hoverForTooltip(choice))?.textContent).toBe(
      NEWER_FILE_REASON,
    );
  });

  it('rings the chip of the live position of this item', async () => {
    const {panel} = await setup();
    const base = emptyLiveState();
    act(() =>
      useLive.setState({
        state: {
          ...base,
          layers: {
            ...base.layers,
            slide: {
              itemId: fixtureItems.arranged,
              position: 2,
              label: '후렴',
              lines: ['빛을 따라가요'],
            },
          },
        },
      }),
    );
    const states = within(strip(panel))
      .getAllByRole('option')
      .map(option => option.getAttribute('data-state'));
    expect(states).toEqual([null, null, 'live']);
  });

  it('opens the source song in the editor', async () => {
    const {panel, user, editor, first} = await setup();
    await user.click(
      within(panel).getByRole('button', {name: '라이브러리 곡 편집'}),
    );
    expect(editor.getSnapshot().session?.document.song.id).toBe(first.song.id);
  });

  it('shows an empty panel for nothing selected and for other kinds', async () => {
    await setup();
    const shownPanel = (): HTMLElement =>
      screen.getByRole('region', {name: '예배 순서 항목'});
    act(() => useShow.setState({openItemId: fixtureItems.slot}));
    expect(within(shownPanel()).queryByRole('listbox')).toBeNull();
    act(() => useShow.setState({openItemId: null}));
    expect(within(shownPanel()).queryByRole('listbox')).toBeNull();
  });
});
