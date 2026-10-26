import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {RecoveryDialog} from './RecoveryDialog';
import {sampleOffer} from './testing';

afterEach(cleanup);

function setup(busy = false) {
  const onRestore = vi.fn();
  const onStartFresh = vi.fn();
  const view = render(
    <RecoveryDialog
      summary={sampleOffer()}
      busy={busy}
      onRestore={onRestore}
      onStartFresh={onStartFresh}
    />,
  );
  return {onRestore, onStartFresh, view};
}

const restoreButton = () => screen.getByRole('button', {name: '복구'});

it('asks with the time of the record and every offered row checked', () => {
  setup();
  const dialog = screen.getByRole('alertdialog', {name: '출력 상태 복구'});
  expect(dialog.textContent).toContain('비정상 종료');
  expect(dialog.textContent).toContain('10월 25일 오전 11:26');
  const group = screen.getByRole('group', {name: '복구할 상태'});
  const boxes = within(group).getAllByRole('checkbox');
  expect(boxes).toHaveLength(3);
  for (const box of boxes) {
    expect(box.getAttribute('aria-checked')).toBe('true');
  }
  expect(document.activeElement).toBe(restoreButton());
});

it('restores the checked rows with Enter, in the offered order', async () => {
  const {onRestore} = setup();
  await userEvent.click(
    screen.getByRole('checkbox', {name: /마지막 슬라이드/}),
  );
  restoreButton().focus();
  await userEvent.keyboard('{Enter}');
  expect(onRestore).toHaveBeenCalledExactlyOnceWith(['outputs', 'showing']);
});

it('starts fresh with Esc', async () => {
  const {onStartFresh, onRestore} = setup();
  await userEvent.keyboard('{Escape}');
  expect(onStartFresh).toHaveBeenCalledOnce();
  expect(onRestore).not.toHaveBeenCalled();
});

it('makes 복구 unavailable with every row unchecked, also for Enter', async () => {
  const {onRestore} = setup();
  for (const box of screen.getAllByRole('checkbox')) {
    await userEvent.click(box);
  }
  expect(restoreButton().getAttribute('aria-disabled')).toBe('true');
  await userEvent.click(restoreButton());
  await userEvent.keyboard('{Enter}');
  expect(onRestore).not.toHaveBeenCalled();
});

it('waits with both answers unavailable while one is on its way', async () => {
  const {onRestore, onStartFresh} = setup(true);
  expect(restoreButton().getAttribute('aria-disabled')).toBe('true');
  expect(
    screen
      .getByRole('button', {name: '새로 시작'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  await userEvent.click(restoreButton());
  expect(onRestore).not.toHaveBeenCalled();
  expect(onStartFresh).not.toHaveBeenCalled();
});
