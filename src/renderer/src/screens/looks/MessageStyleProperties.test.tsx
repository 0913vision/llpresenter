import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
import {MessageStyleProperties} from './MessageStyleProperties';
import type {MessageStyleChange} from './messageStyleEdits';

afterEach(cleanup);

it('submits independent bounded fields and a normalized valid color', () => {
  const change = vi.fn();
  render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason={undefined}
      onChange={change}
    />,
  );
  const size = screen.getByRole('spinbutton', {name: '크기'});
  fireEvent.change(size, {target: {value: '999'}});
  fireEvent.blur(size);
  expect(change).toHaveBeenCalledWith({kind: 'text', change: {size: 300}});
  const color = screen.getByRole('textbox', {name: '글자색'});
  fireEvent.change(color, {target: {value: '#aa2200'}});
  fireEvent.blur(color);
  expect(change).toHaveBeenCalledWith({
    kind: 'text',
    change: {color: '#AA2200'},
  });
  fireEvent.click(screen.getByRole('radio', {name: '왼쪽'}));
  expect(change).toHaveBeenCalledWith({kind: 'text', change: {align: 'left'}});
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  expect(screen.getByRole('dialog', {name: '글자색 선택'})).toBeDefined();
});

it('blocks edits when settings are read-only', () => {
  const change = vi.fn();
  render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason="읽기 전용"
      onChange={change}
    />,
  );
  expect(screen.getByRole('spinbutton', {name: '크기'})).toHaveProperty(
    'readOnly',
    true,
  );
  expect(screen.getByRole('textbox', {name: '글자색'})).toHaveProperty(
    'readOnly',
    true,
  );
  expect(
    screen
      .getByRole('button', {name: '글자색 선택'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('radio', {name: '왼쪽'}));
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  expect(change).not.toHaveBeenCalled();
});

it('clears a successful no-op color reversion after a held save is refused', async () => {
  let finishFirst: (value: boolean) => void = () => undefined;
  let finishSecond: (value: boolean) => void = () => undefined;
  const first = new Promise<boolean>(resolve => {
    finishFirst = resolve;
  });
  const second = new Promise<boolean>(resolve => {
    finishSecond = resolve;
  });
  const change = vi
    .fn<(change: MessageStyleChange) => Promise<boolean>>()
    .mockReturnValueOnce(first)
    .mockReturnValueOnce(second)
    .mockResolvedValue(true);
  const view = render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason={undefined}
      onChange={change}
    />,
  );
  const field = screen.getByRole('textbox', {name: '글자색'});
  fireEvent.change(field, {target: {value: '#112233'}});
  fireEvent.blur(field);
  fireEvent.change(field, {target: {value: '#FFFFFF'}});
  fireEvent.blur(field);
  await act(async () => {
    finishFirst(false);
    finishSecond(true);
  });
  view.rerender(
    <MessageStyleProperties
      style={{...DEFAULT_MESSAGE_STYLE, color: '#445566'}}
      reason={undefined}
      onChange={change}
    />,
  );
  expect(field).toHaveProperty('value', '#445566');
  fireEvent.change(field, {target: {value: '#FFFFFF'}});
  fireEvent.blur(field);
  expect(change.mock.calls.map(call => call[0])).toEqual([
    {kind: 'text', change: {color: '#112233'}},
    {kind: 'text', change: {color: '#FFFFFF'}},
    {kind: 'text', change: {color: '#FFFFFF'}},
  ]);
});

it('restores the published number after a refused save', async () => {
  let resolve: (value: boolean) => void = () => undefined;
  const held = new Promise<boolean>(done => {
    resolve = done;
  });
  const change = vi.fn().mockReturnValue(held);
  render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason={undefined}
      onChange={change}
    />,
  );
  const size = screen.getByRole('spinbutton', {name: '크기'});
  fireEvent.change(size, {target: {value: '120'}});
  fireEvent.keyDown(size, {key: 'Enter'});
  expect(size).toHaveProperty('value', '120');
  await act(async () => {
    resolve(false);
    await held;
  });
  expect(size).toHaveProperty('value', '84');
});

it('retains the latest pending number through earlier published saves', async () => {
  const replies: Array<(value: boolean) => void> = [];
  const change = vi.fn(
    () =>
      new Promise<boolean>(resolve => {
        replies.push(resolve);
      }),
  );
  const view = render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason={undefined}
      onChange={change}
    />,
  );
  const size = screen.getByRole('spinbutton', {name: '크기'});
  for (const value of ['120', '84', '120']) {
    fireEvent.change(size, {target: {value}});
    fireEvent.keyDown(size, {key: 'Enter'});
  }
  expect(change).toHaveBeenCalledTimes(3);
  await act(async () => {
    replies[0]?.(true);
  });
  view.rerender(
    <MessageStyleProperties
      style={{...DEFAULT_MESSAGE_STYLE, size: 120}}
      reason={undefined}
      onChange={change}
    />,
  );
  await act(async () => {
    replies[1]?.(true);
  });
  view.rerender(
    <MessageStyleProperties
      style={{...DEFAULT_MESSAGE_STYLE, size: 84}}
      reason={undefined}
      onChange={change}
    />,
  );
  expect(size).toHaveProperty('value', '120');
  fireEvent.change(size, {target: {value: '84'}});
  fireEvent.keyDown(size, {key: 'Enter'});
  expect(change).toHaveBeenLastCalledWith({kind: 'text', change: {size: 84}});
  expect(change).toHaveBeenCalledTimes(4);
});

it('clears a successful no-op numeric reversion after an earlier refusal', async () => {
  const replies: Array<(value: boolean) => void> = [];
  const change = vi.fn(
    () =>
      new Promise<boolean>(resolve => {
        replies.push(resolve);
      }),
  );
  const view = render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason={undefined}
      onChange={change}
    />,
  );
  const size = screen.getByRole('spinbutton', {name: '크기'});
  for (const value of ['120', '84']) {
    fireEvent.change(size, {target: {value}});
    fireEvent.keyDown(size, {key: 'Enter'});
  }
  await act(async () => {
    replies[0]?.(false);
    replies[1]?.(true);
  });
  view.rerender(
    <MessageStyleProperties
      style={{...DEFAULT_MESSAGE_STYLE, size: 100}}
      reason={undefined}
      onChange={change}
    />,
  );
  expect(size).toHaveProperty('value', '100');
  fireEvent.change(size, {target: {value: '84'}});
  fireEvent.keyDown(size, {key: 'Enter'});
  expect(change).toHaveBeenCalledTimes(3);
});

it('retains the latest pending color through earlier published saves', async () => {
  const replies: Array<(value: boolean) => void> = [];
  const change = vi.fn(
    () =>
      new Promise<boolean>(resolve => {
        replies.push(resolve);
      }),
  );
  const view = render(
    <MessageStyleProperties
      style={DEFAULT_MESSAGE_STYLE}
      reason={undefined}
      onChange={change}
    />,
  );
  const color = screen.getByRole('textbox', {name: '글자색'});
  for (const value of ['#FF0000', '#FFFFFF', '#FF0000']) {
    fireEvent.change(color, {target: {value}});
    fireEvent.blur(color);
  }
  expect(change).toHaveBeenCalledTimes(3);
  await act(async () => {
    replies[0]?.(true);
  });
  view.rerender(
    <MessageStyleProperties
      style={{...DEFAULT_MESSAGE_STYLE, color: '#FF0000'}}
      reason={undefined}
      onChange={change}
    />,
  );
  await act(async () => {
    replies[1]?.(true);
  });
  view.rerender(
    <MessageStyleProperties
      style={{...DEFAULT_MESSAGE_STYLE, color: '#FFFFFF'}}
      reason={undefined}
      onChange={change}
    />,
  );
  expect(color).toHaveProperty('value', '#FF0000');
  fireEvent.change(color, {target: {value: '#FFFFFF'}});
  fireEvent.blur(color);
  expect(change).toHaveBeenLastCalledWith({
    kind: 'text',
    change: {color: '#FFFFFF'},
  });
  expect(change).toHaveBeenCalledTimes(4);
});
