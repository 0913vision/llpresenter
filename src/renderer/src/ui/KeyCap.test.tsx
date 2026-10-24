import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {
  KeyCombo,
  KeyList,
  KeyText,
  conflictText,
  formatShortcut,
} from './KeyCap';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

afterEach(resetTooltips);

describe('formatShortcut', () => {
  it('writes keys with one space between them', () => {
    expect(formatShortcut(['Ctrl', 'Z'])).toBe('Ctrl Z');
    expect(formatShortcut(['F1'])).toBe('F1');
  });
});

describe('conflictText', () => {
  it('names the other command with the right particle', () => {
    expect(conflictText('출력 켜기')).toBe('출력 켜기와 겹침');
    expect(conflictText('다음 장')).toBe('다음 장과 겹침');
  });
});

describe('KeyCombo', () => {
  it('draws each key as a kbd element', () => {
    const {container} = render(<KeyCombo keys={['Ctrl', 'Z']} />);
    expect(
      [...container.querySelectorAll('kbd')].map(k => k.textContent),
    ).toEqual(['Ctrl', 'Z']);
  });

  it('reports a changed shortcut through its state', () => {
    const {container} = render(
      <KeyCombo keys={['Ctrl', '1']} state="changed" />,
    );
    expect(container.firstElementChild?.getAttribute('data-state')).toBe(
      'changed',
    );
  });

  it('names a conflict on its icon and in its tooltip', async () => {
    render(
      <KeyCombo
        keys={['Ctrl', '1']}
        state="warning"
        conflictWith="출력 켜기"
      />,
    );
    const icon = screen.getByRole('img', {name: '출력 켜기와 겹침'});
    expect((await hoverForTooltip(icon))?.textContent).toBe('출력 켜기와 겹침');
  });
});

describe('KeyList', () => {
  it('writes 없음 when a command has no shortcut', () => {
    render(<KeyList />);
    expect(screen.getByText('없음')).toBeDefined();
  });

  it('lists the shortcuts of one command', () => {
    const {container} = render(
      <KeyList>
        <KeyCombo keys={['→']} />
        <KeyCombo keys={['Space']} />
      </KeyList>,
    );
    expect(container.querySelectorAll('kbd')).toHaveLength(2);
  });
});

describe('KeyText', () => {
  it('writes the shortcut as text', () => {
    render(<KeyText keys={['Ctrl', 'Z']} />);
    expect(screen.getByText('Ctrl Z')).toBeDefined();
  });
});
