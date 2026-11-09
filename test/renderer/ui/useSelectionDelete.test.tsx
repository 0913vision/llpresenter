import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {expect, it, vi} from 'vitest';
import {useSelectionDelete} from '@renderer/ui/useSelectionDelete';
import type {Notice} from '@renderer/ui/notices';

function Harness({
  valid,
  remove,
  count = 3,
  report = () => undefined,
}: {
  valid: () => boolean;
  remove: () => void;
  count?: number;
  report?: (notice: Notice) => void;
}) {
  const deletion = useSelectionDelete(report);
  return (
    <>
      <button onClick={() => deletion.ask(count, valid, remove)}>
        Remove selection
      </button>
      {deletion.dialog}
    </>
  );
}

it('deletes one valid item immediately without a confirmation', () => {
  const remove = vi.fn();
  render(<Harness count={1} valid={() => true} remove={remove} />);
  fireEvent.click(screen.getByRole('button', {name: 'Remove selection'}));
  expect(remove).toHaveBeenCalledOnce();
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('cancels unchanged, then removes once after the modal restores the opener', async () => {
  const remove = vi.fn(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: 'Remove selection'}),
    ),
  );
  render(<Harness valid={() => true} remove={remove} />);
  await userEvent.click(screen.getByRole('button', {name: 'Remove selection'}));
  expect(
    screen.getByRole('alertdialog', {name: '3개를 삭제할까요?'}),
  ).toBeDefined();
  await userEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', {name: 'Remove selection'}));
  await userEvent.click(screen.getByRole('button', {name: '삭제'}));
  expect(remove).toHaveBeenCalledTimes(1);
});

it('refuses a confirmation whose captured document is stale', () => {
  let current = true;
  const remove = vi.fn();
  const report = vi.fn();
  render(<Harness valid={() => current} remove={remove} report={report} />);
  fireEvent.click(screen.getByRole('button', {name: 'Remove selection'}));
  current = false;
  fireEvent.click(screen.getByRole('button', {name: '삭제'}));
  expect(remove).not.toHaveBeenCalled();
  expect(screen.queryByRole('alertdialog')).toBeNull();
  expect(report).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      key: 'selection-delete:stale',
      kind: 'info',
      title: '항목이 변경되어 삭제하지 않았습니다',
    }),
  );
});
