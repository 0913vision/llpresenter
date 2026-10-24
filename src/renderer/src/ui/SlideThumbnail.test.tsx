import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {CLICK_FOCUS_SELECTOR} from './clickFocus';
import {SlideThumbnail, ThumbnailGrid, thumbnailName} from './SlideThumbnail';
import {missingFileText} from './MissingFile';
import type {Workspace} from './workspace';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

const COLUMNS = 3;
const SLIDE_COUNT = 7;
const lyrics = '만복의 근원 하나님\n온 백성 찬송 드리고';

interface SongGridProps {
  readonly workspace: Workspace;
  readonly initial?: number;
  readonly onOutput?: (index: number) => void;
  readonly onSelect?: (index: number) => void;
}

function OutsideSelection({
  selected,
}: {
  readonly selected: number;
}): JSX.Element {
  return (
    <>
      <button type="button">밖</button>
      <ThumbnailGrid
        label="장"
        columns={COLUMNS}
        selected={selected}
        workspace="show"
        onSelect={() => {}}
        onOutput={() => {}}
      >
        {Array.from({length: SLIDE_COUNT}, (_, index) => (
          <SlideThumbnail
            key={index}
            number={index + 1}
            text={`${index + 1}번째 줄`}
            selected={index === selected}
          />
        ))}
      </ThumbnailGrid>
    </>
  );
}

function SongGrid({
  workspace,
  initial,
  onOutput = () => {},
  onSelect = () => {},
}: SongGridProps): JSX.Element {
  const [selected, setSelected] = useState<number | undefined>(initial);
  const select = (index: number): void => {
    setSelected(index);
    onSelect(index);
  };
  const thumbnails = Array.from({length: SLIDE_COUNT}, (_, index) => (
    <SlideThumbnail
      key={index}
      number={index + 1}
      text={`${index + 1}번째 줄`}
      selected={index === selected}
    />
  ));
  const common = {label: '장', columns: COLUMNS, selected, onSelect: select};
  return (
    <>
      <button type="button">밖</button>
      {workspace === 'show' ? (
        <ThumbnailGrid {...common} workspace="show" onOutput={onOutput}>
          {thumbnails}
        </ThumbnailGrid>
      ) : (
        <ThumbnailGrid {...common} workspace="prep">
          {thumbnails}
        </ThumbnailGrid>
      )}
    </>
  );
}

function thumbnail(number: number): HTMLElement {
  return screen.getByRole('option', {name: `${number}, ${number}번째 줄`});
}

function selectedNumbers(): Array<string | undefined> {
  return screen
    .getAllByRole('option')
    .filter(option => option.getAttribute('aria-selected') === 'true')
    .map(option => option.getAttribute('aria-label')?.split(',')[0]);
}

function watchWindowKeys(): KeyboardEvent[] {
  const seen: KeyboardEvent[] = [];
  const listener = (event: KeyboardEvent): void => {
    seen.push(event);
  };
  window.addEventListener('keydown', listener);
  onTestFinished(() => window.removeEventListener('keydown', listener));
  return seen;
}

describe('thumbnailName', () => {
  it('reads the number, the 이름표, and the first line', () => {
    expect(
      thumbnailName({number: 2, label: '프리코러스', text: '저 천사여\n아멘'}),
    ).toBe('2 프리코러스, 저 천사여');
  });

  it('leaves out what the 장 does not have', () => {
    expect(thumbnailName({number: 4, text: lyrics})).toBe(
      '4, 만복의 근원 하나님',
    );
    expect(thumbnailName({number: 3, label: '광고'})).toBe('3 광고');
    expect(thumbnailName({number: 5, text: ''})).toBe('5');
  });
});

describe('SlideThumbnail', () => {
  function renderOne(element: JSX.Element): HTMLElement {
    render(
      <ThumbnailGrid
        label="장"
        columns={COLUMNS}
        selected={undefined}
        workspace="prep"
        onSelect={() => {}}
      >
        {element}
      </ThumbnailGrid>,
    );
    return screen.getByRole('option');
  }

  it('writes the number and the 이름표 in the band and keeps the line breaks', () => {
    const option = renderOne(
      <SlideThumbnail
        number={2}
        label="프리코러스"
        labelColor="green"
        text={lyrics}
      />,
    );
    expect(option.getAttribute('aria-label')).toBe(
      '2 프리코러스, 만복의 근원 하나님',
    );
    expect(option.getAttribute('data-color')).toBe('green');
    expect(option.textContent).toBe(`${lyrics}2프리코러스`);
  });

  it('writes only the number for a 장 without an 이름표', () => {
    const option = renderOne(<SlideThumbnail number={4} text={lyrics} />);
    expect(option.getAttribute('data-color')).toBeNull();
    expect(option.textContent).toBe(`${lyrics}4`);
  });

  it('marks live, the missing file, and both in data-state', () => {
    const {rerender} = render(<SlideThumbnail number={1} live />);
    expect(screen.getByRole('option').getAttribute('data-state')).toBe('live');
    rerender(<SlideThumbnail number={1} missingFile="D:\\광고.png" />);
    expect(screen.getByRole('option').getAttribute('data-state')).toBe(
      'warning',
    );
    rerender(<SlideThumbnail number={1} live missingFile="D:\\광고.png" />);
    expect(screen.getByRole('option').getAttribute('data-state')).toBe(
      'live warning',
    );
    rerender(<SlideThumbnail number={1} selected />);
    expect(screen.getByRole('option').getAttribute('data-state')).toBeNull();
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('draws the media of the 장 without a name of its own', () => {
    const option = renderOne(
      <SlideThumbnail number={3} media="blob:announcement" />,
    );
    expect(option.querySelector('img')?.getAttribute('src')).toBe(
      'blob:announcement',
    );
    expect(option.querySelector('img')?.getAttribute('alt')).toBe('');
  });

  it('shows the warning instead of the media when the file is missing', async () => {
    const path = 'D:\\예배 미디어\\광고\\11월 1일 광고.png';
    const option = renderOne(
      <SlideThumbnail
        number={4}
        media="blob:announcement"
        missingFile={path}
      />,
    );
    expect(option.querySelector('img')).toBeNull();
    expect((await hoverForTooltip(option))?.textContent).toBe(
      missingFileText(path),
    );
    expect(missingFileText(path)).toBe(
      '파일을 찾을 수 없습니다: D:\\예배 미디어\\광고\\11월 1일 광고.png',
    );
  });

  it('has no tooltip while its file is there', async () => {
    const option = renderOne(<SlideThumbnail number={4} text={lyrics} />);
    expect(await hoverForTooltip(option)).toBeNull();
  });
});

describe('ThumbnailGrid', () => {
  it('sets the column count and takes focus on a click in 진행', () => {
    render(<SongGrid workspace="show" />);
    const grid = screen.getByRole('listbox', {name: '장'});
    expect(grid.style.getPropertyValue('--thumb-columns')).toBe(`${COLUMNS}`);
    expect(thumbnail(2).closest(CLICK_FOCUS_SELECTOR)).toBe(grid);
  });

  it('takes one Tab stop, on the selected thumbnail', async () => {
    const user = userEvent.setup();
    render(<SongGrid workspace="show" initial={4} />);
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(thumbnail(5));
    await user.tab();
    expect(document.activeElement).toBe(document.body);
  });

  it('passes focus to the first thumbnail while none is selected', async () => {
    const user = userEvent.setup();
    render(<SongGrid workspace="prep" />);
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(thumbnail(1));
  });

  describe('in 진행', () => {
    it('outputs a 장 on a click and on Enter', async () => {
      const user = userEvent.setup();
      const onOutput = vi.fn<(index: number) => void>();
      render(<SongGrid workspace="show" initial={0} onOutput={onOutput} />);
      await user.click(thumbnail(3));
      expect(onOutput).toHaveBeenLastCalledWith(2);
      thumbnail(1).focus();
      await user.keyboard('{Enter}');
      expect(onOutput).toHaveBeenLastCalledWith(0);
      expect(onOutput).toHaveBeenCalledTimes(2);
    });

    it('moves up and down by a row and stops at the edges', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn<(index: number) => void>();
      render(<SongGrid workspace="show" initial={1} onSelect={onSelect} />);
      thumbnail(2).focus();
      await user.keyboard('{ArrowDown}');
      expect(selectedNumbers()).toEqual(['5']);
      expect(document.activeElement).toBe(thumbnail(5));
      await user.keyboard('{ArrowDown}');
      expect(selectedNumbers()).toEqual(['5']);
      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(selectedNumbers()).toEqual(['2']);
      expect(onSelect.mock.calls).toEqual([[4], [1]]);
    });

    it('leaves ←, →, Space, Page Up, and Page Down to the live commands', async () => {
      const user = userEvent.setup();
      const seen = watchWindowKeys();
      const onOutput = vi.fn<(index: number) => void>();
      render(<SongGrid workspace="show" initial={1} onOutput={onOutput} />);
      thumbnail(2).focus();
      await user.keyboard('{ArrowRight}{ArrowLeft}{ }{PageDown}{PageUp}');
      expect(seen.map(event => [event.key, event.defaultPrevented])).toEqual([
        ['ArrowRight', false],
        ['ArrowLeft', false],
        [' ', false],
        ['PageDown', false],
        ['PageUp', false],
      ]);
      expect(selectedNumbers()).toEqual(['2']);
      expect(onOutput).not.toHaveBeenCalled();
    });

    it('lets keys with a modifier pass', async () => {
      const user = userEvent.setup();
      const seen = watchWindowKeys();
      render(<SongGrid workspace="show" initial={1} />);
      thumbnail(2).focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
      expect(seen.at(-1)?.defaultPrevented).toBe(false);
      expect(selectedNumbers()).toEqual(['2']);
    });

    it('moves focus with a selection that 다음 장 changes', () => {
      const {rerender} = render(<OutsideSelection selected={0} />);
      thumbnail(1).focus();
      rerender(<OutsideSelection selected={6} />);
      expect(document.activeElement).toBe(thumbnail(7));
    });

    it('leaves focus outside the grid where it is', () => {
      const {rerender} = render(<OutsideSelection selected={0} />);
      const outside = screen.getByRole('button', {name: '밖'});
      outside.focus();
      rerender(<OutsideSelection selected={6} />);
      expect(document.activeElement).toBe(outside);
    });
  });

  describe('in 준비', () => {
    it('selects on a click, on Enter, and on Space', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn<(index: number) => void>();
      render(<SongGrid workspace="prep" onSelect={onSelect} />);
      await user.click(thumbnail(3));
      thumbnail(6).focus();
      await user.keyboard('{Enter}');
      thumbnail(4).focus();
      await user.keyboard(' ');
      expect(onSelect.mock.calls).toEqual([[2], [5], [3]]);
    });

    it('moves with every arrow key', async () => {
      const user = userEvent.setup();
      render(<SongGrid workspace="prep" initial={0} />);
      thumbnail(1).focus();
      await user.keyboard('{ArrowRight}');
      expect(selectedNumbers()).toEqual(['2']);
      await user.keyboard('{ArrowDown}');
      expect(selectedNumbers()).toEqual(['5']);
      await user.keyboard('{ArrowLeft}');
      expect(document.activeElement).toBe(thumbnail(4));
      await user.keyboard('{ArrowUp}{ArrowLeft}{ArrowLeft}');
      expect(selectedNumbers()).toEqual(['1']);
    });
  });
});
