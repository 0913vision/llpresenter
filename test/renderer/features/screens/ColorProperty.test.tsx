import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {COLOR_CODE_REASON} from '@core/schema/slides/textStyle';
import {ColorProperty} from '@renderer/features/screens/ColorProperty';

afterEach(cleanup);

function setUp(
  more: {
    value?: string;
    reason?: string;
    allowNone?: boolean;
    inheritedColor?: string;
  } = {},
) {
  const commit = vi.fn<(value: string) => void>();
  render(
    <ColorProperty
      label="글자색"
      value={more.value ?? '#1E2761'}
      reason={more.reason}
      commit={commit}
      allowNone={more.allowNone ?? false}
      {...(more.inheritedColor === undefined
        ? {}
        : {inheritedColor: more.inheritedColor})}
    />,
  );
  const field = screen.getByRole('textbox', {name: '글자색'});
  const type = (text: string): void => {
    field.focus();
    fireEvent.change(field, {target: {value: text}});
    fireEvent.keyDown(field, {key: 'Enter'});
  };
  return {commit, field, type};
}

it('keeps a typed color code in capitals', () => {
  const {commit, type} = setUp();
  type('#f96167');
  expect(commit).toHaveBeenCalledWith('#F96167');
});

it('says how to write a color code, and keeps a wrong one out', () => {
  const {commit, field} = setUp();
  field.focus();
  fireEvent.change(field, {target: {value: '#12'}});
  expect(field.getAttribute('aria-invalid')).toBe('true');
  expect(document.body.textContent).toContain(COLOR_CODE_REASON);
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(commit).not.toHaveBeenCalled();
});

it('takes an empty code as no color only where no color is allowed', () => {
  const none = setUp({allowNone: true});
  none.type('');
  expect(none.commit).toHaveBeenCalledWith('');
  cleanup();
  const color = setUp();
  color.type('');
  expect(color.commit).not.toHaveBeenCalled();
});

it('chooses a color in its dialog, from the color in use, and applies only a change', () => {
  const {commit} = setUp({value: '#102030'});
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  expect(screen.getByRole('slider', {name: '빨강'})).toHaveProperty(
    'value',
    String(0x10),
  );
  fireEvent.click(screen.getByRole('button', {name: '적용'}));
  expect(commit).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  fireEvent.change(screen.getByRole('slider', {name: '파랑'}), {
    target: {value: '255'},
  });
  fireEvent.click(screen.getByRole('button', {name: '적용'}));
  expect(commit).toHaveBeenCalledWith('#1020FF');
});

it('starts the dialog of an empty color at the color it takes from elsewhere, and can choose no color', () => {
  const {commit} = setUp({
    value: '',
    allowNone: true,
    inheritedColor: '#FFFF00',
  });
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  expect(screen.getByRole('slider', {name: '파랑'})).toHaveProperty(
    'value',
    '0',
  );
  fireEvent.click(screen.getByRole('button', {name: '없음'}));
  expect(commit).not.toHaveBeenCalled();
});

it('opens nothing while the color can not be changed', () => {
  setUp({reason: '기본 테마는 바꿀 수 없습니다.'});
  const swatch = screen.getByRole('button', {name: '글자색 선택'});
  expect(swatch).toHaveProperty('disabled', true);
  expect(swatch.title).toBe('기본 테마는 바꿀 수 없습니다.');
});
