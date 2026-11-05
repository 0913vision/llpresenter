import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ClearTarget} from '@core/live/commands';
import {
  ClearButton,
  ClearRow,
  ClearUndo,
  clearLabel,
} from '@renderer/ui/ClearButton';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

const layers: readonly ClearTarget[] = [
  'all',
  'slide',
  'media',
  'prop',
  'audio',
  'message',
];
const OFF: ReadonlySet<ClearTarget> = new Set(['audio']);

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
  it('gives each clear button its key and shows it in a tooltip', async () => {
    render(<Row />);
    expect(button('모두 지우기').getAttribute('aria-keyshortcuts')).toBe('F1');
    expect((await hoverForTooltip(button('가사 지우기')))?.textContent).toBe(
      '가사 지우기F2',
    );
  });

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

  it('writes the name as the layer name and 지우기', () => {
    expect(clearLabel('prop')).toBe('그래픽 지우기');
  });
});
