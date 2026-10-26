import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  ArrangementStrip,
  LabelSwatch,
  LabelTag,
  type ArrangementChip,
} from './LabelChip';
import {labelInk} from './labelInk';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';
import {passedKeys, recordWindowKeys} from './windowKeysTesting';

afterEach(resetTooltips);

const chips: readonly ArrangementChip[] = [
  {key: 'a', name: '1절', color: 'teal', number: 1},
  {key: 'b', name: '후렴', color: 'yellow', number: 2},
  {key: 'c', name: undefined, color: 'none', number: 4},
];

interface Handlers {
  readonly onMove?: (from: number, to: number) => void;
  readonly onRemove?: (index: number) => void;
  readonly onInsert?: (button: HTMLElement) => void;
  readonly readOnlyReason?: string;
}

function Strip({
  onMove = () => undefined,
  onRemove = () => undefined,
  onInsert = () => undefined,
  readOnlyReason,
}: Handlers): JSX.Element {
  const [selected, setSelected] = useState(0);
  return (
    <ArrangementStrip
      label="구성"
      chips={chips}
      selected={selected}
      live={1}
      onSelect={setSelected}
      onMove={onMove}
      onRemove={onRemove}
      onInsert={onInsert}
      readOnlyReason={readOnlyReason}
    />
  );
}

function RemovableStrip(): JSX.Element {
  const [shown, setShown] = useState(chips);
  const [selected, setSelected] = useState(0);
  return (
    <ArrangementStrip
      label="구성"
      chips={shown}
      selected={selected}
      onSelect={setSelected}
      onMove={() => undefined}
      onRemove={index => setShown(shown.filter((_, at) => at !== index))}
      onInsert={() => undefined}
    />
  );
}

function tabStops(): string[] {
  return screen
    .getAllByRole('option')
    .filter(option => option.tabIndex === 0)
    .map(option => option.textContent);
}

function selectedChip(): string | null {
  return screen.getByRole('option', {selected: true}).textContent;
}

describe('ArrangementStrip', () => {
  it('is a horizontal list of chips named by 이름표 or number', () => {
    render(<Strip />);
    const strip = screen.getByRole('listbox', {name: '구성'});
    expect(strip.getAttribute('aria-orientation')).toBe('horizontal');
    expect(
      screen.getAllByRole('option').map(option => option.textContent),
    ).toEqual(['1절', '후렴', '4']);
  });

  it('marks the chip of the live group', () => {
    render(<Strip />);
    expect(
      screen.getByRole('option', {name: '후렴'}).getAttribute('data-state'),
    ).toBe('live');
  });

  it('selects chips with the arrows, Home, and End', async () => {
    render(<Strip />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(selectedChip()).toBe('후렴');
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '후렴'}),
    );
    await userEvent.keyboard('{End}');
    expect(selectedChip()).toBe('4');
    await userEvent.keyboard('{Home}');
    expect(selectedChip()).toBe('1절');
  });

  it('moves a chip with Alt and the arrows, within the strip', async () => {
    const onMove = vi.fn();
    render(<Strip onMove={onMove} />);
    await userEvent.tab();
    await userEvent.keyboard('{Alt>}{ArrowLeft}{ArrowRight}{/Alt}');
    expect(onMove.mock.calls).toEqual([[0, 1]]);
  });

  it('passes the chip keys on with any modifier but Alt alone', async () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    render(<Strip onMove={onMove} onRemove={onRemove} />);
    await userEvent.tab();
    const keys = recordWindowKeys();
    await userEvent.keyboard(
      '{Control>}{ArrowRight}{Delete}{/Control}{Shift>}{End}{/Shift}' +
        '{Control>}{Alt>}{ArrowRight}{/Alt}{/Control}',
    );
    expect(selectedChip()).toBe('1절');
    expect(onMove).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(passedKeys(keys)).toEqual([
      'Control',
      'ArrowRight',
      'Delete',
      'Shift',
      'End',
      'Control',
      'Alt',
      'ArrowRight',
    ]);
  });

  it('only selects while read-only and gives the reason in tooltips', async () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    const onInsert = vi.fn();
    const reason = '기본 구성은 변경할 수 없습니다';
    render(
      <Strip
        onMove={onMove}
        onRemove={onRemove}
        onInsert={onInsert}
        readOnlyReason={reason}
      />,
    );
    expect(
      screen.getByRole('listbox', {name: '구성'}).getAttribute('aria-readonly'),
    ).toBe('true');
    await userEvent.tab();
    const keys = recordWindowKeys();
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}{Delete}{ArrowRight}');
    expect(onMove).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(passedKeys(keys)).toEqual(['Alt']);
    expect(selectedChip()).toBe('후렴');
    const insert = screen.getByRole('button', {name: '슬라이드 넣기'});
    expect(insert.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(insert);
    expect(onInsert).not.toHaveBeenCalled();
    expect((await hoverForTooltip(insert))?.textContent).toBe(reason);
    const chip = screen.getByRole('option', {name: '1절'});
    expect((await hoverForTooltip(chip))?.textContent).toBe(reason);
  });

  it('takes a chip out with Delete', async () => {
    const onRemove = vi.fn();
    render(<Strip onRemove={onRemove} />);
    await userEvent.tab();
    await userEvent.keyboard('{Delete}');
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('selects and focuses the chip before a removed last chip', async () => {
    render(<RemovableStrip />);
    await userEvent.tab();
    await userEvent.keyboard('{End}{Delete}');
    expect(selectedChip()).toBe('후렴');
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '후렴'}),
    );
    expect(tabStops()).toEqual(['후렴']);
  });

  it('selects and focuses the next chip after a removed chip', async () => {
    render(<RemovableStrip />);
    await userEvent.tab();
    await userEvent.keyboard('{Delete}');
    expect(selectedChip()).toBe('후렴');
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '후렴'}),
    );
  });

  it('gives focus to the insert button once the last chip is gone', async () => {
    render(<RemovableStrip />);
    await userEvent.tab();
    await userEvent.keyboard('{Delete}{Delete}{Delete}');
    expect(screen.queryAllByRole('option')).toEqual([]);
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '슬라이드 넣기'}),
    );
  });

  it('keeps a Tab stop on the last chip when the selection is past the end', () => {
    render(
      <ArrangementStrip
        label="구성"
        chips={chips}
        selected={chips.length + 2}
        onSelect={() => undefined}
        onMove={() => undefined}
        onRemove={() => undefined}
        onInsert={() => undefined}
      />,
    );
    expect(tabStops()).toEqual(['4']);
  });

  it('names the insert button in a tooltip', async () => {
    render(<Strip />);
    const insert = screen.getByRole('button', {name: '슬라이드 넣기'});
    expect((await hoverForTooltip(insert))?.textContent).toBe('슬라이드 넣기');
  });

  it('asks to insert from a named button', async () => {
    const onInsert = vi.fn();
    render(<Strip onInsert={onInsert} />);
    const insert = screen.getByRole('button', {name: '슬라이드 넣기'});
    await userEvent.click(insert);
    expect(onInsert).toHaveBeenCalledWith(insert);
  });

  it('draws the drop position where a chip would land', () => {
    render(
      <ArrangementStrip
        label="구성"
        chips={chips}
        selected={0}
        dropIndex={1}
        draggingIndex={0}
        onSelect={() => undefined}
        onMove={() => undefined}
        onRemove={() => undefined}
        onInsert={() => undefined}
      />,
    );
    const options = screen.getAllByRole('option');
    const drop = screen
      .getByRole('listbox', {name: '구성'})
      .querySelector(':scope > span');
    expect(drop?.nextElementSibling).toBe(options[1]);
    expect(options[0]?.getAttribute('data-dragging')).toBe('true');
  });
});

describe('LabelTag', () => {
  it('shows the 이름표 name', () => {
    render(<LabelTag name="후렴" color="yellow" />);
    expect(screen.getByText('후렴')).toBeDefined();
  });

  it('opens the 이름표 menu as a picker and names an empty one 이름표', async () => {
    const onOpen = vi.fn();
    render(
      <LabelTag
        name={undefined}
        color="none"
        picker={{expanded: true, onOpen}}
      />,
    );
    const picker = screen.getByRole('button', {name: '이름표'});
    expect(picker.getAttribute('aria-haspopup')).toBe('menu');
    expect(picker.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(picker);
    expect(onOpen).toHaveBeenCalledWith(picker);
  });
});

describe('LabelSwatch', () => {
  it('is hidden from assistive technology', () => {
    const {container} = render(<LabelSwatch color="green" />);
    expect(container.firstElementChild?.getAttribute('aria-hidden')).toBe(
      'true',
    );
  });
});

describe('labelInk', () => {
  it('paints an 이름표 color with the label text color', () => {
    expect(labelInk('teal')).toEqual({
      '--label-fill': 'var(--label-teal)',
      '--label-ink': 'var(--text-on-label)',
    });
  });

  it('paints no 이름표 with gray text on label-none', () => {
    expect(labelInk('none')).toEqual({
      '--label-fill': 'var(--label-none)',
      '--label-ink': 'var(--label-gray)',
    });
  });
});
