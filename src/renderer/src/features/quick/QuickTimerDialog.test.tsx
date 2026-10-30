import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {QuickEdit} from './quickEdits';
import {QuickTimerDialog} from './QuickTimerDialog';

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
    .mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const fill = (name: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', {name}), {target: {value}});

it('requires a positive whole duration and focuses minutes with inline errors', () => {
  const save = vi.fn<(edit: QuickEdit) => Promise<boolean>>();
  const close = vi.fn();
  render(<QuickTimerDialog locked={false} save={save} onClose={close} />);
  expect(document.activeElement).toBe(
    screen.getByRole('textbox', {name: '분'}),
  );
  expect(
    screen.getByRole('textbox', {name: '분'}).getAttribute('aria-invalid'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(save).not.toHaveBeenCalled();
  fill('초', '60');
  expect(
    screen.getByRole('textbox', {name: '초'}).getAttribute('aria-invalid'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(close).toHaveBeenCalledOnce();
  expect(save).not.toHaveBeenCalled();
});

it('creates one fresh timer with duration and overrun, closing only after acceptance', async () => {
  const save = vi
    .fn<(edit: QuickEdit) => Promise<boolean>>()
    .mockResolvedValue(true);
  const close = vi.fn();
  render(<QuickTimerDialog locked={false} save={save} onClose={close} />);
  fill('분', '1');
  fill('초', '30');
  fireEvent.click(screen.getByRole('radio', {name: '멈춤'}));
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(save).toHaveBeenCalledExactlyOnceWith({
    kind: 'timer-add',
    quickItemId: '00000000-0000-4000-8000-000000000001',
    timerId: '00000000-0000-4000-8000-000000000002',
    duration: 90,
    overrun: false,
  });
});

it('keeps stable identities after refusal and prevents writes while locked', async () => {
  const save = vi
    .fn<(edit: QuickEdit) => Promise<boolean>>()
    .mockResolvedValue(false);
  const close = vi.fn();
  const {rerender} = render(
    <QuickTimerDialog locked={false} save={save} onClose={close} />,
  );
  fill('초', '10');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
  rerender(<QuickTimerDialog locked save={save} onClose={close} />);
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(save).toHaveBeenCalledTimes(2);
});
