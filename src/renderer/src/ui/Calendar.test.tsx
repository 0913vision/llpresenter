import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {DateSelect} from './DateSelect';
import {Dialog} from './Dialog';
import {resetTooltips} from './tooltipTesting';

const disconnect = vi.fn();
const observe = vi.fn();

beforeEach(() => {
  disconnect.mockClear();
  observe.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = observe;
      disconnect = disconnect;
    },
  );
});
afterEach(() => {
  resetTooltips();
  vi.unstubAllGlobals();
});

function Field({
  initial = '2026-11-01',
  today = '2026-10-26',
  onChange = () => undefined,
  disabled = false,
}: {
  readonly initial?: string;
  readonly today?: string;
  readonly onChange?: (value: string) => void;
  readonly disabled?: boolean;
}): JSX.Element {
  const [date, setDate] = useState(initial);
  return (
    <DateSelect
      aria-label="날짜"
      value={date}
      today={today}
      disabled={disabled}
      onChange={value => {
        setDate(value);
        onChange(value);
      }}
    />
  );
}

const opener = (): HTMLElement => screen.getByRole('button', {name: '날짜'});
const popup = (): HTMLElement =>
  screen.getByRole('dialog', {name: '날짜 선택'});
const activeLabel = (): string | null =>
  document.activeElement?.getAttribute('aria-label') ?? null;

describe('calendar date field', () => {
  it('does not choose a day from modified keyboard activation', async () => {
    const change = vi.fn();
    render(<Field initial="2026-10-28" onChange={change} />);
    await userEvent.click(opener());
    const day = screen.getByRole('button', {name: '2026년 10월 28일 수요일'});
    const onKeyDown = vi.fn();
    window.addEventListener('keydown', onKeyDown);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      for (const key of [' ', 'Enter']) {
        fireEvent.keyDown(day, {key, [modifier]: true});
        fireEvent.keyUp(day, {key});
        fireEvent.click(day, {detail: 0});
        expect(popup()).toBeDefined();
      }
      expect(fireEvent.keyDown(day, {key: 'Escape', [modifier]: true})).toBe(
        true,
      );
      expect(popup()).toBeDefined();
    }
    window.removeEventListener('keydown', onKeyDown);
    expect(onKeyDown).toHaveBeenCalledTimes(12);
    expect(change).not.toHaveBeenCalled();
    fireEvent.click(day, {detail: 1, ctrlKey: true});
    expect(change).toHaveBeenCalledExactlyOnceWith('2026-10-28');
  });

  it('follows an external date change and closes when the field becomes disabled', async () => {
    const change = vi.fn();
    const {rerender} = render(
      <DateSelect aria-label="날짜" value="2026-01-31" onChange={change} />,
    );
    await userEvent.click(opener());
    rerender(
      <DateSelect aria-label="날짜" value="2027-06-10" onChange={change} />,
    );
    expect(activeLabel()).toBe('2027년 6월 10일 목요일');
    rerender(
      <DateSelect
        aria-label="날짜"
        value="2027-06-10"
        onChange={change}
        disabled
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(
      <DateSelect aria-label="날짜" value="2027-06-10" onChange={change} />,
    );
    expect(opener().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens a bounded grid on the selected date with separate today and selection', async () => {
    render(<Field initial="2026-10-28" />);
    expect(opener().getAttribute('aria-haspopup')).toBe('dialog');
    await userEvent.click(opener());
    expect(screen.getAllByRole('gridcell')).toHaveLength(42);
    expect(screen.getByRole('gridcell', {selected: true}).textContent).toBe(
      '28',
    );
    expect(activeLabel()).toBe('2026년 10월 28일 수요일');
    expect(
      screen
        .getByRole('button', {name: '2026년 10월 26일 월요일'})
        .getAttribute('aria-current'),
    ).toBe('date');
    expect(opener().getAttribute('aria-controls')).toBe(popup().id);
  });

  it('moves within and across months and years without committing until Enter', async () => {
    const change = vi.fn();
    render(<Field initial="2026-01-31" onChange={change} />);
    await userEvent.click(opener());
    await userEvent.keyboard('{PageDown}');
    expect(activeLabel()).toBe('2026년 2월 28일 토요일');
    await userEvent.keyboard('{ArrowRight}');
    expect(activeLabel()).toBe('2026년 3월 1일 일요일');
    await userEvent.keyboard('{Shift>}{PageDown}{/Shift}');
    expect(activeLabel()).toBe('2027년 3월 1일 월요일');
    expect(change).not.toHaveBeenCalled();
    await userEvent.keyboard('{Enter}');
    expect(change).toHaveBeenCalledExactlyOnceWith('2027-03-01');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener());
  });

  it('moves by week and week edges and leaves modified keys alone', async () => {
    const change = vi.fn();
    render(<Field initial="2026-11-11" onChange={change} />);
    await userEvent.click(opener());
    await userEvent.keyboard('{Home}{End}{ArrowUp}{ArrowLeft}{ArrowDown}');
    expect(activeLabel()).toBe('2026년 11월 13일 금요일');
    await userEvent.keyboard('{Control>}{ArrowRight}{/Control}');
    expect(activeLabel()).toBe('2026년 11월 13일 금요일');
    expect(change).not.toHaveBeenCalled();
  });

  it('browses with month buttons without moving their focus, then chooses today', async () => {
    const change = vi.fn();
    render(<Field onChange={change} />);
    await userEvent.click(opener());
    const next = screen.getByRole('button', {name: '다음 달'});
    await userEvent.click(next);
    expect(screen.getByRole('heading', {name: '2026년 12월'})).toBeDefined();
    expect(document.activeElement).toBe(next);
    expect(change).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', {name: '오늘'}));
    expect(change).toHaveBeenCalledExactlyOnceWith('2026-10-26');
    expect(document.activeElement).toBe(opener());
  });

  it('traps Tab and closes only the calendar on Escape inside a parent dialog', async () => {
    const cancel = vi.fn();
    const create = vi.fn();
    render(
      <Dialog
        title="새 예배"
        size="s"
        onCancel={cancel}
        primary={{label: '만들기', onSelect: create}}
      >
        <Field />
      </Dialog>,
    );
    await userEvent.click(opener());
    const day = document.activeElement;
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '오늘'}),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '이전 달'}),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '다음 달'}),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(day);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', {name: '날짜 선택'})).toBeNull();
    expect(screen.getByRole('dialog', {name: '새 예배'})).toBeDefined();
    expect(document.activeElement).toBe(opener());
    expect(cancel).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('commits on Space without submitting the parent dialog', async () => {
    const change = vi.fn();
    const create = vi.fn();
    render(
      <Dialog
        title="새 예배"
        size="s"
        onCancel={() => undefined}
        primary={{label: '만들기', onSelect: create}}
      >
        <Field onChange={change} />
      </Dialog>,
    );
    await userEvent.click(opener());
    await userEvent.keyboard(' ');
    expect(change).toHaveBeenCalledExactlyOnceWith('2026-11-01');
    expect(create).not.toHaveBeenCalled();
  });

  it('dismisses outside and lets the clicked control receive focus and act', async () => {
    const outside = vi.fn();
    render(
      <>
        <Field />
        <button onClick={outside}>다른 작업</button>
      </>,
    );
    await userEvent.click(opener());
    const other = screen.getByRole('button', {name: '다른 작업'});
    await userEvent.click(other);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(other);
    expect(outside).toHaveBeenCalledOnce();
  });

  it('disables out-of-range days and navigation at both year limits', async () => {
    const {unmount} = render(<Field initial="0000-01-01" />);
    await userEvent.click(opener());
    expect(
      screen
        .getByRole('button', {name: '이전 달'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(popup().querySelectorAll('button:disabled')).toHaveLength(6);
    await userEvent.keyboard('{Home}{PageUp}');
    expect(activeLabel()).toBe('0년 1월 1일 토요일');
    unmount();
    render(<Field initial="9999-12-31" />);
    await userEvent.click(opener());
    expect(
      screen
        .getByRole('button', {name: '다음 달'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    await userEvent.keyboard('{ArrowRight}{PageDown}');
    expect(activeLabel()).toBe('9999년 12월 31일 금요일');
  });

  it('never opens a disabled field', async () => {
    render(<Field disabled />);
    await userEvent.click(opener());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(observe).not.toHaveBeenCalled();
  });

  it('keeps one grid and releases observers and document listeners through repeated openings', async () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const {unmount} = render(<Field />);
    for (let count = 0; count < 20; count++) {
      await userEvent.click(opener());
      expect(screen.getAllByRole('gridcell')).toHaveLength(42);
      await userEvent.keyboard('{Escape}');
    }
    await waitFor(() => expect(disconnect).toHaveBeenCalledTimes(20));
    unmount();
    for (const [name, callback, capture] of add.mock.calls.filter(
      ([name]) => name === 'pointerdown' || name === 'scroll',
    )) {
      expect(
        remove.mock.calls.some(
          call =>
            call[0] === name && call[1] === callback && call[2] === capture,
        ),
      ).toBe(true);
    }
    fireEvent(window, new Event('resize'));
  });
});
