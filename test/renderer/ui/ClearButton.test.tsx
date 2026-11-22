import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import type {ClearTarget} from '@core/schema/live';
import {ClearButton, ClearRow, clearLabel} from '@renderer/ui/ClearButton';
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
  compact = false,
}: {
  readonly onClear?: (layer: ClearTarget) => void;
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

  it('writes the name as the layer name and 지우기', () => {
    expect(clearLabel('prop')).toBe('그래픽 지우기');
  });
});
