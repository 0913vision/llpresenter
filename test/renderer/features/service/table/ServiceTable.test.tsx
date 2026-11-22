import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ServiceItem} from '@core/schema/service';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {ServiceTableList} from '@renderer/features/service/table/ServiceTableList';
import {useThemes} from '@renderer/platform/themes';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {
  itemId,
  openServiceFixture,
} from '@fixtures/renderer/session/openServiceFixture';

const SONG = itemId(2);
const MACRO = '00000000-0000-4000-8000-000000000301';
const macros = settingsDocument('macros', {
  macros: [
    {id: MACRO, name: '점검 1분', icon: 'bolt', color: 'teal', actions: []},
  ],
  collections: [],
});

const order = (song: object = {}): readonly ServiceItem[] => [
  {id: itemId(1), kind: 'header', name: '찬양'},
  {
    id: SONG,
    kind: 'song',
    name: '새 노래',
    slides: [
      slideOf(1, 'songTitle', {texts: {제목: '새 노래'}}),
      lyricsSlide(2, '첫 줄'),
      lyricsSlide(3, '둘째 줄'),
    ],
    ...song,
  },
  {id: itemId(3), kind: 'blank', name: '빈 슬라이드', slides: []},
];

function setup(song: object = {}, readOnly = false) {
  const service = openServiceFixture(order(song), {
    readOnly,
    api: {
      settings: {
        get: () => Promise.resolve(macros),
        subscribe: () => () => undefined,
      },
    },
  });
  const report = vi.fn();
  return {
    ...service,
    report,
    own: () => service.item(SONG),
    showTable: () =>
      render(<ServiceTableList api={service.api} onProblem={report} />),
  };
}

const row = (name: RegExp) => screen.getByRole('option', {name});
const cell = (name: string) =>
  screen.getByRole('button', {name: `${name}, 새 노래`});

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useThemes.setState({themes: themes(), screens: themeScreens});
});

describe('the table of the service', () => {
  it('shows how many slides an item has, its macro, and its memo', async () => {
    setup({macro: MACRO, memo: '간주 길게'}).showTable();
    await waitFor(() => expect(cell('시작할 때').textContent).toBe('점검 1분'));
    expect(cell('메모').textContent).toBe('간주 길게');
    expect(within(row(/새 노래/u)).getByText('3')).toBeTruthy();
  });

  it('changes what starts with an item, and takes it away', async () => {
    const {own, showTable} = setup();
    showTable();
    await userEvent.click(cell('시작할 때'));
    await userEvent.click(
      await screen.findByRole('menuitemradio', {name: '점검 1분'}),
    );
    await waitFor(() => expect(own()).toMatchObject({macro: MACRO}));
    await userEvent.click(cell('시작할 때'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: '없음'}));
    await waitFor(() => expect(own()).not.toHaveProperty('macro'));
  });

  it('edits a memo in its cell, saved with Enter or on the way out', async () => {
    const {own, showTable} = setup({memo: '간주'});
    showTable();
    await userEvent.click(cell('메모'));
    const field = screen.getByRole('textbox', {name: '메모, 새 노래'});
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, {target: {value: '간주 길게'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(own()).toMatchObject({memo: '간주 길게'}));
    await waitFor(() => expect(document.activeElement).toBe(cell('메모')));
    await userEvent.click(cell('메모'));
    const again = screen.getByRole('textbox', {name: '메모, 새 노래'});
    fireEvent.change(again, {target: {value: '버릴 글'}});
    fireEvent.keyDown(again, {key: 'Escape'});
    expect(cell('메모').textContent).toBe('간주 길게');
  });

  it('keeps a memo that was refused in its field', async () => {
    const {edit, own, showTable} = setup();
    showTable();
    edit.mockResolvedValueOnce({
      ok: false,
      error: {reason: 'invalid', message: 'Invented refusal'},
    });
    await userEvent.click(cell('메모'));
    const field = screen.getByRole('textbox', {name: '메모, 새 노래'});
    fireEvent.change(field, {target: {value: '간주 길게'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(edit).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        screen.getByRole<HTMLInputElement>('textbox', {name: '메모, 새 노래'})
          .value,
      ).toBe('간주 길게'),
    );
    expect(own()).not.toHaveProperty('memo');
  });

  it('moves between a row and its cells with the arrows', async () => {
    setup().showTable();
    await waitFor(() => expect(cell('시작할 때')).toBeTruthy());
    const item = row(/새 노래/u);
    item.focus();
    fireEvent.keyDown(item, {key: 'ArrowRight'});
    expect(document.activeElement).toBe(cell('시작할 때'));
    fireEvent.keyDown(cell('시작할 때'), {key: 'ArrowRight'});
    expect(document.activeElement).toBe(cell('메모'));
    fireEvent.keyDown(cell('메모'), {key: 'Delete'});
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.keyDown(cell('메모'), {key: 'ArrowLeft'});
    fireEvent.keyDown(cell('시작할 때'), {key: 'ArrowLeft'});
    expect(document.activeElement).toBe(item);
  });

  it('changes nothing in a service of a newer version', async () => {
    const {edit, showTable} = setup({memo: '간주'}, true);
    showTable();
    await userEvent.click(cell('메모'));
    expect(screen.queryByRole('textbox', {name: '메모, 새 노래'})).toBeNull();
    expect(edit).not.toHaveBeenCalled();
  });
});

describe('the details of an item', () => {
  function showDetails(id = SONG) {
    const service = setup({memo: '간주'});
    const onOpenItem = vi.fn();
    render(
      <DetailsPanel
        target={{kind: 'item', itemId: id}}
        api={service.api}
        sizeClass="normal"
        onOpenItem={onOpenItem}
        onOpenSong={vi.fn()}
        report={service.report}
      />,
    );
    return {...service, onOpenItem};
  }

  it('shows what an item is and lets its memo change', async () => {
    const {own} = showDetails();
    const memo = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '메모',
    });
    expect(memo.value).toBe('간주');
    fireEvent.change(memo, {target: {value: '간주 길게'}});
    fireEvent.blur(memo);
    await waitFor(() => expect(own()).toMatchObject({memo: '간주 길게'}));
  });

  it('opens the editor at a slide of its grid', async () => {
    const {onOpenItem} = showDetails();
    await userEvent.click(screen.getByRole('tab', {name: '슬라이드'}));
    const [, second] = screen.getAllByRole('option');
    if (second === undefined) throw new Error('Missing slide');
    await userEvent.dblClick(second);
    expect(onOpenItem).toHaveBeenCalledWith(SONG, 1);
  });

  it('counts the items of a section', () => {
    showDetails(itemId(1));
    expect(screen.getByText('구역, 항목 2개')).toBeTruthy();
  });
});
