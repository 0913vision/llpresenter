import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it} from 'vitest';
import {Gallery} from './Gallery';

describe('Gallery slide terminology', () => {
  it('keeps Bible chapter references distinct from slide counts', () => {
    render(<Gallery only="ListRow" />);
    const bibleRows = screen.getAllByRole('option', {
      name: '요한복음 3장 16절',
    });
    expect(
      bibleRows.some(row => within(row).queryByText('슬라이드 2개') !== null),
    ).toBe(true);
    expect(screen.getAllByText('슬라이드 9개').length).toBeGreaterThan(0);
    expect(screen.getByText('5:00')).toBeDefined();
  });

  it('names slide panels and counts without changing their positions', () => {
    render(<Gallery only="Panel" />);
    expect(
      screen.getAllByRole('region', {name: '슬라이드'}).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('슬라이드 9개')).toBeDefined();
    expect(screen.getByText('2 / 9')).toBeDefined();
  });

  it('names the import split control and preview as slides', async () => {
    render(<Gallery only="Overlays" />);
    await userEvent.click(
      screen.getByRole('button', {name: '텍스트 가져오기'}),
    );
    const dialog = screen.getByRole('dialog', {name: '텍스트 가져오기'});
    expect(
      within(dialog).getByRole('radiogroup', {name: '슬라이드 나누기'}),
    ).toBeDefined();
    expect(within(dialog).getByText('슬라이드 미리보기')).toBeDefined();
  });
});
