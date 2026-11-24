import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {ServiceItem} from '@core/schema/services/service';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {ServiceTableList} from '@renderer/features/service/table/ServiceTableList';
import {useThemes} from '@renderer/platform/documents/themes';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {
  itemId,
  openServiceFixture,
} from '@fixtures/renderer/session/openServiceFixture';

const SONG = itemId(2);

function order(song: object = {}): readonly ServiceItem[] {
  return [
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
}

function setup(song: object = {}, readOnly = false) {
  const service = openServiceFixture(order(song), {readOnly});
  const report = vi.fn();
  return {
    ...service,
    report,
    showTable: () => render(<ServiceTableList onProblem={report} />),
  };
}

function row(name: RegExp) {
  return screen.getByRole('option', {name});
}

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useThemes.setState({themes: themes(), screens: themeScreens});
});

describe('the table of the service', () => {
  it('shows the name and how many slides an item has, and nothing else', () => {
    setup().showTable();
    expect(within(row(/새 노래/u)).getByText('3')).toBeTruthy();
    expect(screen.queryByText('시작할 때')).toBeNull();
    expect(screen.queryByText('메모')).toBeNull();
  });
});

describe('the details of an item', () => {
  function showDetails(id = SONG) {
    const service = setup();
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

  it('shows the source and the slides at once, with no tabs', async () => {
    showDetails();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('textbox', {name: '메모'})).toBeNull();
    expect(screen.queryByText('시작할 때')).toBeNull();
    expect(await screen.findByText('원본')).toBeTruthy();
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('opens the editor at a slide of its grid', async () => {
    const {onOpenItem} = showDetails();
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
