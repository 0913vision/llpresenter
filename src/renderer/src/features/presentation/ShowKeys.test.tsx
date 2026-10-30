import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as showState from '@renderer/features/presentation/state/show';
import {useShowKeys} from './shortcuts';

function Host({onPress}: {readonly onPress: () => void}) {
  useShowKeys();
  return (
    <>
      <button type="button" onClick={onPress}>
        Pressable
      </button>
      <input aria-label="field" />
    </>
  );
}

beforeEach(() => {
  vi.spyOn(showState, 'outputNext').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('the live keys with a real keyboard', () => {
  it('lets a button that Tab reached be pressed once by a full Space press', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Host onPress={onPress} />);

    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: 'Pressable'}),
    );
    await user.keyboard(' ');

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('outputs the next 장 and presses nothing when no control has focus', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Host onPress={onPress} />);

    await user.keyboard(' ');

    expect(showState.outputNext).toHaveBeenCalledTimes(1);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('types a space in a text field and outputs nothing', async () => {
    const user = userEvent.setup();
    render(<Host onPress={() => undefined} />);

    await user.click(screen.getByRole('textbox', {name: 'field'}));
    await user.keyboard(' ');

    expect(screen.getByRole('textbox', {name: 'field'})).toHaveProperty(
      'value',
      ' ',
    );
    expect(showState.outputNext).not.toHaveBeenCalled();
  });

  it('does not let a mouse click on a button take the focus, so a later Space is next 장', async () => {
    const onPress = vi.fn();
    const user = userEvent.setup();
    render(<Host onPress={onPress} />);

    await user.click(screen.getByRole('button', {name: 'Pressable'}));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(
      screen.getByRole('button', {name: 'Pressable'}),
    );
    await user.keyboard(' ');

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(showState.outputNext).toHaveBeenCalledTimes(1);
  });
});
