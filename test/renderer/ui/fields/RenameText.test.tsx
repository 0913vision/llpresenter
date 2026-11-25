import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {RenameText} from '@renderer/ui/fields/RenameText';

function field(onCommit = vi.fn()) {
  render(
    <RenameText
      label="이름"
      value="주일 예배"
      readOnly={false}
      onCommit={onCommit}
    />,
  );
  return screen.getByRole('textbox', {name: '이름'});
}

it('keeps a name whose last syllable is still being composed when Esc ends the composition', () => {
  const name = field();
  fireEvent.change(name, {target: {value: '주일 2부 예배'}});
  fireEvent.keyDown(name, {key: 'Escape', isComposing: true});
  expect(name).toHaveProperty('value', '주일 2부 예배');
});

it('takes the typed name back with Esc, and commits a changed name once when left', () => {
  const onCommit = vi.fn();
  const name = field(onCommit);
  fireEvent.change(name, {target: {value: '주일 2부 예배'}});
  fireEvent.keyDown(name, {key: 'Escape'});
  expect(name).toHaveProperty('value', '주일 예배');
  fireEvent.change(name, {target: {value: ' 수요 예배 '}});
  fireEvent.blur(name);
  expect(onCommit).toHaveBeenCalledExactlyOnceWith('수요 예배');
});
