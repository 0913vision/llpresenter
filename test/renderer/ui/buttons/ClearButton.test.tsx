import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {clearButtons} from '@core/live';
import {ClearButton, ClearGroup, ClearRow} from '@renderer/ui/buttons/ClearButton';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

function Row({
  onPress = () => {},
  compact = false,
}: {
  readonly onPress?: (name: string) => void;
  readonly compact?: boolean;
}): JSX.Element {
  return (
    <ClearRow compact={compact}>
      <ClearGroup>
        {clearButtons.map(({target, label, icon, command}) => (
          <ClearButton
            key={target}
            name={label}
            icon={icon}
            label={`${label} 지우기`}
            command={command}
            active={target !== 'audio'}
            onPress={() => onPress(label)}
          />
        ))}
      </ClearGroup>
    </ClearRow>
  );
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', {name});
}

describe('ClearRow', () => {
  it('gives each button its key and shows it in a tooltip', async () => {
    render(<Row />);
    expect(button('모두 지우기').getAttribute('aria-keyshortcuts')).toBe('F1');
    expect((await hoverForTooltip(button('가사 지우기')))?.textContent).toBe(
      '가사 지우기F2',
    );
  });

  it('draws a button that does nothing off and ignores its press', async () => {
    const press = vi.fn<(name: string) => void>();
    render(<Row onPress={press} />);
    const audio = button('오디오 지우기');
    expect(audio.getAttribute('data-state')).toBe('off');
    expect(audio.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(audio);
    await userEvent.click(button('가사 지우기'));
    expect(press.mock.calls).toEqual([['가사']]);
  });

  it('shows only icons in the compact form', () => {
    render(<Row compact />);
    expect(screen.queryByText('가사')).toBeNull();
    expect(button('가사 지우기')).toBeTruthy();
  });
});
