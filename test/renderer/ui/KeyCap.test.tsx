import {render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {KeyCombo, KeyList, KeyText, conflictText} from '@renderer/ui/KeyCap';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';

afterEach(resetTooltips);

describe('conflictText', () => {
  it('names the other command with the right particle', () => {
    expect(conflictText('출력 켜기')).toBe('출력 켜기와 겹침');
    expect(conflictText('다음 슬라이드')).toBe('다음 슬라이드와 겹침');
  });
});

describe('KeyCombo', () => {
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
