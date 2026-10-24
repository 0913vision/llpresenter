import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {MacroColor} from '@shared/colors';
import {
  MacroGrid,
  MacroList,
  MacroRow,
  MacroTile,
  macroName,
  scheduleMeta,
  scheduleText,
  type MacroSchedule,
} from './MacroTile';
import type {MenuAnchor} from './Menu';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

const AT_TEN_THIRTY: MacroSchedule = {kind: 'time', time: '10:30'};
const AT_STARTUP: MacroSchedule = {kind: 'startup'};

interface Macro {
  readonly name: string;
  readonly icon: string;
  readonly color: MacroColor;
  readonly actionCount: number;
  readonly schedule?: MacroSchedule;
}

const macros: readonly Macro[] = [
  {
    name: '예배 시작',
    icon: 'sun',
    color: 'green',
    actionCount: 4,
    schedule: AT_TEN_THIRTY,
  },
  {name: '찬양', icon: 'song', color: 'teal', actionCount: 2},
  {name: '말씀', icon: 'mic', color: 'slate', actionCount: 1},
];

interface GridHandlers {
  readonly onRun?: (index: number) => void;
  readonly onMenu?: (index: number, anchor: MenuAnchor) => void;
  readonly onNew?: () => void;
}

function Grid({
  onRun = () => {},
  onMenu = () => {},
  onNew,
}: GridHandlers): JSX.Element {
  return (
    <MacroGrid
      label="매크로"
      selected={2}
      onRun={onRun}
      onMenu={onMenu}
      onNew={onNew}
    >
      {macros.map((macro, index) => (
        <MacroTile
          key={macro.name}
          {...macro}
          lastRun={index === 1}
          selected={index === 2}
        />
      ))}
    </MacroGrid>
  );
}

function tile(name: string): HTMLElement {
  return screen.getByRole('option', {name});
}

describe('macro schedule text', () => {
  it('writes a time and the startup run', () => {
    expect(scheduleText(AT_TEN_THIRTY)).toBe('10:30에 실행');
    expect(scheduleText(AT_STARTUP)).toBe('시작할 때 실행');
    expect(scheduleMeta(AT_TEN_THIRTY)).toBe('10:30');
    expect(scheduleMeta(AT_STARTUP)).toBe('시작할 때');
  });

  it('adds the schedule to the name', () => {
    expect(macroName('예배 시작', AT_TEN_THIRTY)).toBe(
      '예배 시작, 10:30에 실행',
    );
    expect(macroName('찬양')).toBe('찬양');
  });
});

describe('MacroTile', () => {
  it('names a tile with its schedule and marks last run and selected', () => {
    render(<Grid />);
    expect(tile('예배 시작, 10:30에 실행').getAttribute('data-color')).toBe(
      'green',
    );
    expect(tile('찬양').getAttribute('data-state')).toBe('last-run');
    expect(tile('말씀').getAttribute('aria-selected')).toBe('true');
  });

  it('shows the schedule in a tooltip only on a scheduled tile', async () => {
    render(<Grid />);
    expect(
      (await hoverForTooltip(tile('예배 시작, 10:30에 실행')))?.textContent,
    ).toBe('예배 시작, 10:30에 실행');
    resetTooltips();
    expect(await hoverForTooltip(tile('찬양'))).toBe(null);
  });
});

describe('MacroGrid', () => {
  it('runs a macro on a click, Enter, and Space', async () => {
    const onRun = vi.fn<(index: number) => void>();
    render(<Grid onRun={onRun} />);
    await userEvent.click(tile('찬양'));
    tile('말씀').focus();
    await userEvent.keyboard('{Enter} ');
    expect(onRun.mock.calls).toEqual([[1], [2], [2]]);
  });

  it('moves keyboard focus with the arrows and keeps the selection', async () => {
    render(<Grid />);
    tile('찬양').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(tile('예배 시작, 10:30에 실행'));
    expect(tile('말씀').getAttribute('aria-selected')).toBe('true');
  });

  it('opens the macro menu on a right-click', () => {
    const onMenu = vi.fn<(index: number, anchor: MenuAnchor) => void>();
    render(<Grid onMenu={onMenu} />);
    fireEvent.contextMenu(tile('찬양'), {clientX: 12, clientY: 34});
    expect(onMenu).toHaveBeenCalledWith(1, {
      kind: 'point',
      point: {x: 12, y: 34},
    });
  });

  it('ends with the 새 매크로 slot, outside the list of macros', async () => {
    const onNew = vi.fn<() => void>();
    render(<Grid onNew={onNew} />);
    const add = screen.getByRole('button', {name: '새 매크로'});
    expect(add.closest('[role="listbox"]')).toBe(null);
    expect(screen.getAllByRole('option')).toHaveLength(macros.length);
    await userEvent.click(add);
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('has no 새 매크로 slot without onNew', () => {
    render(<Grid />);
    expect(screen.queryByRole('button', {name: '새 매크로'})).toBe(null);
  });
});

describe('MacroList', () => {
  it('writes the schedule and the action count in each row', () => {
    render(
      <MacroList
        label="매크로"
        selected={undefined}
        onRun={() => {}}
        onMenu={() => {}}
      >
        {macros.map(macro => (
          <MacroRow key={macro.name} {...macro} />
        ))}
        <MacroRow
          name="예배 끝"
          icon="stop"
          color="gray"
          actionCount={3}
          schedule={AT_STARTUP}
        />
      </MacroList>,
    );
    expect(tile('예배 시작, 10:30에 실행').textContent).toBe(
      '예배 시작10:30동작 4개',
    );
    expect(tile('찬양').textContent).toBe('찬양동작 2개');
    expect(tile('예배 끝, 시작할 때 실행').textContent).toBe(
      '예배 끝시작할 때동작 3개',
    );
  });

  it('moves keyboard focus down the rows', async () => {
    render(
      <MacroList
        label="매크로"
        selected={undefined}
        onRun={() => {}}
        onMenu={() => {}}
      >
        {macros.map(macro => (
          <MacroRow key={macro.name} {...macro} />
        ))}
      </MacroList>,
    );
    tile('찬양').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(tile('말씀'));
  });
});
