import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ClearTarget} from '@core/live/commands';
import {ClearButton, ClearRow, ClearUndo, clearLabel} from './ClearButton';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

const layers: readonly ClearTarget[] = [
  'all',
  'slide',
  'media',
  'prop',
  'audio',
  'message',
  'notice',
];
const OFF: ReadonlySet<ClearTarget> = new Set(['audio', 'notice']);

function Row({
  onClear = () => {},
  onUndo = () => {},
  undoAvailable = true,
  compact = false,
}: {
  readonly onClear?: (layer: ClearTarget) => void;
  readonly onUndo?: () => void;
  readonly undoAvailable?: boolean;
  readonly compact?: boolean;
}): JSX.Element {
  return (
    <ClearRow compact={compact}>
      {layers.map(layer => (
        <ClearButton
          key={layer}
          layer={layer}
          active={!OFF.has(layer)}
          onClear={() => onClear(layer)}
        />
      ))}
      <ClearUndo available={undoAvailable} onUndo={onUndo} />
    </ClearRow>
  );
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', {name});
}

describe('ClearRow', () => {
  it('is a group named 지우기 with the buttons in their order', () => {
    render(<Row />);
    const row = screen.getByRole('group', {name: '지우기'});
    expect(
      [...row.querySelectorAll('button')].map(b =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual([
      '모두 지우기',
      '가사 지우기',
      '미디어 지우기',
      '그래픽 지우기',
      '오디오 지우기',
      '메시지 지우기',
      '공지 지우기',
      '되돌리기',
    ]);
  });

  it('gives each clear button its key and shows it in a tooltip', async () => {
    render(<Row />);
    expect(button('모두 지우기').getAttribute('aria-keyshortcuts')).toBe('F1');
    expect(button('공지 지우기').getAttribute('aria-keyshortcuts')).toBe('F7');
    expect((await hoverForTooltip(button('가사 지우기')))?.textContent).toBe(
      '가사 지우기F2',
    );
  });

  it.each([true, false])(
    'advertises no default clear undo shortcut when available is %s',
    async available => {
      render(<ClearUndo available={available} onUndo={vi.fn()} />);
      const undo = button('되돌리기');
      expect(undo.hasAttribute('aria-keyshortcuts')).toBe(false);
      expect((await hoverForTooltip(undo))?.textContent).toBe('되돌리기');
    },
  );

  it('shows only an explicitly supplied clear undo shortcut', async () => {
    const onUndo = vi.fn();
    const {rerender} = render(
      <ClearUndo available onUndo={onUndo} shortcut="Ctrl Shift U" />,
    );
    const undo = button('되돌리기');
    expect(undo.getAttribute('aria-keyshortcuts')).toBe('Control+Shift+U');
    expect((await hoverForTooltip(undo))?.textContent).toBe(
      '되돌리기Ctrl Shift U',
    );
    rerender(<ClearUndo available onUndo={onUndo} />);
    expect(undo.hasAttribute('aria-keyshortcuts')).toBe(false);
    expect(screen.getByRole('tooltip').textContent).toBe('되돌리기');
  });

  it('passes Ctrl Z through without undoing a clear', () => {
    const onUndo = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <div onKeyDown={onKeyDown}>
        <ClearUndo available onUndo={onUndo} />
      </div>,
    );
    const undo = button('되돌리기');
    undo.focus();
    expect(
      fireEvent.keyDown(undo, {key: 'z', code: 'KeyZ', ctrlKey: true}),
    ).toBe(true);
    expect(onKeyDown).toHaveBeenCalledOnce();
    expect(onUndo).not.toHaveBeenCalled();
  });

  it('shows a key that the 단축키 page changed', () => {
    render(
      <ClearRow>
        <ClearButton layer="slide" active onClear={() => {}} shortcut="F9" />
      </ClearRow>,
    );
    expect(button('가사 지우기').getAttribute('aria-keyshortcuts')).toBe('F9');
  });

  it('clears a layer on a press', async () => {
    const onClear = vi.fn<(layer: ClearTarget) => void>();
    render(<Row onClear={onClear} />);
    await userEvent.click(button('가사 지우기'));
    button('모두 지우기').focus();
    await userEvent.keyboard('{Enter}');
    expect(onClear.mock.calls).toEqual([['slide'], ['all']]);
  });

  it('draws a layer with nothing to clear off and ignores its press', async () => {
    const onClear = vi.fn<(layer: ClearTarget) => void>();
    render(<Row onClear={onClear} />);
    const audio = button('오디오 지우기');
    expect(audio.getAttribute('data-state')).toBe('off');
    expect(audio.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(audio);
    expect(onClear).not.toHaveBeenCalled();
  });

  it('undoes only while there is something to undo', async () => {
    const onUndo = vi.fn<() => void>();
    const {rerender} = render(<Row onUndo={onUndo} />);
    await userEvent.click(button('되돌리기'));
    rerender(<Row onUndo={onUndo} undoAvailable={false} />);
    expect(button('되돌리기').getAttribute('data-state')).toBe('off');
    await userEvent.click(button('되돌리기'));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('keeps the names for assistive technology in the narrow form', () => {
    render(<Row compact />);
    expect(button('메시지 지우기')).toBeDefined();
    const icon = button('메시지 지우기').querySelector('[aria-hidden="true"]');
    expect(icon?.getAttribute('style')).toContain('width: 16px');
  });

  it('writes the name as the layer name and 지우기', () => {
    expect(clearLabel('prop')).toBe('그래픽 지우기');
  });
});
