import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {TimerDialog} from './TimerDialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByRole('textbox', {name: label}), {
    target: {value},
  });
const choose = (name: string) => {
  fireEvent.click(screen.getByRole('button', {name: '타이머 종류'}));
  fireEvent.click(screen.getByRole('menuitemradio', {name}));
};
const setup = (locked = false) => {
  const save = vi.fn().mockResolvedValue(true);
  const close = vi.fn();
  render(<TimerDialog locked={locked} onSave={save} onClose={close} />);
  return {save, close};
};

it('requires a positive countdown and saves its overrun choice', async () => {
  const f = setup();
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).not.toHaveBeenCalled();
  change('초', '60');
  expect(
    screen.getByRole('textbox', {name: '초'}).getAttribute('aria-invalid'),
  ).toBe('true');
  change('분', '2');
  change('초', '5');
  fireEvent.click(screen.getByRole('radio', {name: '멈춤'}));
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).toHaveBeenCalledExactlyOnceWith({
    kind: 'countdown',
    duration: 125,
    overrun: false,
  });
  await waitFor(() => expect(f.close).toHaveBeenCalledOnce());
});

it('rejects nonexistent dates and invalid local times before saving a dated target', async () => {
  const f = setup();
  choose('날짜와 시각');
  change('날짜', '2027-02-29');
  change('시각', '24:00');
  expect(
    screen.getByRole('textbox', {name: '날짜'}).getAttribute('aria-invalid'),
  ).toBe('true');
  expect(
    screen.getByRole('textbox', {name: '시각'}).getAttribute('aria-invalid'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).not.toHaveBeenCalled();
  change('날짜', '2028-02-29');
  change('시각', '23:59');
  fireEvent.click(screen.getByRole('radio', {name: '멈춤'}));
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).toHaveBeenCalledExactlyOnceWith({
    kind: 'countdownTo',
    date: '2028-02-29',
    time: '23:59',
    overrun: false,
  });
  await waitFor(() => expect(f.close).toHaveBeenCalledOnce());
});

it('allows elapsed zero, blocks invalid duration and preserves a draft across kind switches', async () => {
  const f = setup();
  choose('경과');
  expect(screen.queryByRole('radio', {name: '계속'})).toBeNull();
  expect(
    screen.getByRole('button', {name: '추가'}).getAttribute('aria-disabled'),
  ).not.toBe('true');
  change('초', '-1');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).not.toHaveBeenCalled();
  change('분', '1');
  change('초', '15');
  choose('시계');
  expect(screen.queryByRole('textbox')).toBeNull();
  choose('경과');
  expect(screen.getByRole('textbox', {name: '초'})).toHaveProperty(
    'value',
    '15',
  );
  change('분', '0');
  change('초', '0');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).toHaveBeenCalledExactlyOnceWith({kind: 'elapsed', start: 0});
  await waitFor(() => expect(f.close).toHaveBeenCalledOnce());
});

it('saves a clock without hidden duration fields and leaves a refused save open', async () => {
  const f = setup();
  f.save.mockResolvedValue(false);
  choose('시계');
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).toHaveBeenCalledExactlyOnceWith({kind: 'clock'});
  await Promise.resolve();
  expect(f.close).not.toHaveBeenCalled();
});

it('blocks saving and kind changes when locked and cancels without saving', () => {
  const f = setup(true);
  fireEvent.click(screen.getByRole('button', {name: '타이머 종류'}));
  expect(screen.queryByRole('menu')).toBeNull();
  fireEvent.click(screen.getByRole('button', {name: '추가'}));
  expect(f.save).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  expect(f.close).toHaveBeenCalledOnce();
});
