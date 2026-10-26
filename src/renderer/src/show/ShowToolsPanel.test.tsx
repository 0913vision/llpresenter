import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it} from 'vitest';
import {ShowToolsPanel} from './ShowToolsPanel';

afterEach(cleanup);

const tabNames = (): readonly string[] =>
  within(screen.getByRole('tablist'))
    .getAllByRole('tab')
    .map(tab => tab.textContent);

it.each(['normal', 'wide'] as const)(
  'shows all eight tabs without 더 보기 in a %s window',
  sizeClass => {
    render(<ShowToolsPanel sizeClass={sizeClass} />);
    expect(tabNames()).toHaveLength(8);
    expect(screen.queryByRole('button', {name: '더 보기'})).toBeNull();
  },
);

it('shows 표시 중, 무대, and 더 보기 in a narrow window', () => {
  render(<ShowToolsPanel sizeClass="narrow" />);
  expect(tabNames()).toEqual(['표시 중', '무대']);
  expect(
    screen.getByRole('tab', {name: '표시 중'}).getAttribute('aria-selected'),
  ).toBe('true');
  expect(screen.getByRole('tabpanel', {name: '표시 중'})).toBeDefined();
  expect(
    screen.getByRole('button', {name: '더 보기'}).getAttribute('aria-haspopup'),
  ).toBe('menu');
});

it('opens a 더 보기 tool and shows 더 보기 as the active tab', async () => {
  render(<ShowToolsPanel sizeClass="narrow" />);
  const more = screen.getByRole('button', {name: '더 보기'});
  await userEvent.click(more);
  const menu = screen.getByRole('menu', {name: '더 보기'});
  expect(
    within(menu)
      .getAllByRole('menuitemradio')
      .map(item => item.textContent),
  ).toEqual(['오디오', '타이머', '메시지', '공지', '소품', '매크로']);
  await userEvent.click(
    within(menu).getByRole('menuitemradio', {name: '타이머'}),
  );
  expect(screen.queryByRole('menu')).toBeNull();
  expect(screen.getByRole('tabpanel', {name: '타이머'})).toBeDefined();
  expect(more.hasAttribute('data-active')).toBe(true);
  expect(
    screen
      .getAllByRole('tab')
      .filter(tab => tab.getAttribute('aria-selected') === 'true'),
  ).toHaveLength(0);
  await userEvent.click(more);
  expect(
    screen
      .getByRole('menuitemradio', {name: '타이머'})
      .getAttribute('aria-checked'),
  ).toBe('true');
});

it('opens 더 보기 with the down arrow', async () => {
  render(<ShowToolsPanel sizeClass="narrow" />);
  screen.getByRole('button', {name: '더 보기'}).focus();
  await userEvent.keyboard('{ArrowDown}');
  expect(screen.getByRole('menu', {name: '더 보기'})).toBeDefined();
});

it('keeps the chosen tool when the window grows out of narrow', async () => {
  const {rerender} = render(<ShowToolsPanel sizeClass="narrow" />);
  await userEvent.click(screen.getByRole('button', {name: '더 보기'}));
  await userEvent.click(screen.getByRole('menuitemradio', {name: '메시지'}));
  rerender(<ShowToolsPanel sizeClass="normal" />);
  expect(
    screen.getByRole('tab', {name: '메시지'}).getAttribute('aria-selected'),
  ).toBe('true');
  rerender(<ShowToolsPanel sizeClass="narrow" />);
  expect(
    screen.getByRole('button', {name: '더 보기'}).hasAttribute('data-active'),
  ).toBe(true);
});

it('selects a tab with the arrow keys', async () => {
  render(<ShowToolsPanel sizeClass="narrow" />);
  screen.getByRole('tab', {name: '표시 중'}).focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('tabpanel', {name: '무대'})).toBeDefined();
});
