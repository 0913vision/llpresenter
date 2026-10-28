import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ScreenGroupActions} from './ScreenGroupActions';

afterEach(cleanup);

it('lets modified navigation reach window shortcuts without selecting a row', () => {
  const keyDown = vi.fn();
  const toggle = vi.fn();
  render(
    <div onKeyDown={keyDown}>
      <ScreenGroupActions
        kind="audience"
        label="Audience"
        reason={undefined}
        outputReason={undefined}
        on={false}
        add={vi.fn()}
        toggle={toggle}
      />
    </div>,
  );
  const button = screen.getAllByRole('button')[0];
  if (button === undefined) {
    throw new Error('Missing group action');
  }
  fireEvent.keyDown(button, {key: 'ArrowDown'});
  expect(keyDown).not.toHaveBeenCalled();
  fireEvent.keyDown(button, {key: 'ArrowDown', ctrlKey: true});
  fireEvent.keyDown(button, {key: 'ArrowUp', shiftKey: true});
  fireEvent.keyDown(button, {key: 'Home', metaKey: true});
  fireEvent.keyDown(button, {key: 'End', altKey: true});
  expect(keyDown).toHaveBeenCalledTimes(4);
  expect(toggle).not.toHaveBeenCalled();
});
