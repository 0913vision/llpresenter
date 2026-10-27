import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {SlideHotKeyDialog} from './SlideHotKeyDialog';
import {slideHotKeyPress} from './slideHotKeyPress';

afterEach(cleanup);

function setup(value?: string, disabledReason?: string) {
  const onSave = vi.fn(() => true);
  const onClose = vi.fn();
  render(
    <SlideHotKeyDialog
      value={value}
      slideNumber={3}
      otherAssignments={[{code: 'KeyD', slideNumber: 2}]}
      disabledReason={disabledReason}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return {
    onSave,
    onClose,
    field: screen.getByRole('textbox', {name: '슬라이드 바로 가기 키'}),
    save: screen.getByRole('button', {name: '저장'}),
  };
}

describe('SlideHotKeyDialog', () => {
  it('records a physical key in Korean mode and saves only that source-slide assignment', async () => {
    const {field, onSave, onClose, save} = setup();
    expect(document.activeElement).toBe(field);
    expect(field.hasAttribute('data-shortcut-recording')).toBe(true);
    fireEvent.keyDown(field, {key: 'ㅊ', code: 'KeyC'});
    expect(screen.getByDisplayValue('C')).toBe(field);
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledExactlyOnceWith('KeyC');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('blocks another source slide key until a different assignment is recorded', async () => {
    const {field, onSave, save} = setup();
    fireEvent.keyDown(field, {key: 'd', code: 'KeyD'});
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect(save.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(save);
    fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.keyDown(field, {key: 'b', code: 'KeyB'});
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledExactlyOnceWith('KeyB');
  });

  it.each(['Backspace', 'Delete'])(
    'removes an assignment with %s',
    async code => {
      const {field, onSave, save} = setup('KeyC');
      fireEvent.keyDown(field, {key: code, code});
      expect(screen.getByPlaceholderText('없음').getAttribute('value')).toBe(
        '',
      );
      await userEvent.click(save);
      expect(onSave).toHaveBeenCalledExactlyOnceWith(undefined);
    },
  );

  it('offers an explicit clear button and leaves a refused edit open', async () => {
    const {onSave, onClose, save} = setup('KeyC');
    onSave.mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', {name: '지우기'}));
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledExactlyOnceWith(undefined);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('allows cancellation without applying the draft', async () => {
    const {field, onSave, onClose} = setup();
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC'});
    await userEvent.keyboard('{Escape}');
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores composing and held keys and resumes recording after composition', () => {
    const {field} = setup('KeyA');
    fireEvent.compositionStart(field);
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC'});
    expect(screen.getByDisplayValue('A')).toBe(field);
    fireEvent.compositionEnd(field);
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC', isComposing: true});
    fireEvent.keyDown(field, {key: 'Process', code: 'KeyC'});
    fireEvent.keyDown(field, {key: 'b', code: 'KeyB', repeat: true});
    expect(screen.getByDisplayValue('A')).toBe(field);
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC'});
    expect(screen.getByDisplayValue('C')).toBe(field);
  });

  it('keeps a read-only assignment unchanged and does not save a no-op', async () => {
    const {field, onSave, save} = setup('KeyC', '읽기 전용 곡입니다');
    fireEvent.keyDown(field, {key: 'b', code: 'KeyB'});
    await userEvent.click(screen.getByRole('button', {name: '지우기'}));
    await userEvent.click(save);
    expect(screen.getByDisplayValue('C')).toBe(field);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not save an unchanged editable assignment', async () => {
    const {field, onSave, save} = setup('KeyC');
    fireEvent.keyDown(field, {key: 'Enter', code: 'Enter'});
    await userEvent.click(save);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a valid assignment when Shift Tab moves focus backwards', async () => {
    const {field, save, onSave} = setup();
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC'});
    await userEvent.tab({shift: true});
    expect(document.activeElement).not.toBe(field);
    expect(save.getAttribute('aria-disabled')).not.toBe('true');
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledExactlyOnceWith('KeyC');
  });

  it('confirms a valid assignment with numeric keypad Enter', () => {
    const {field, onSave, onClose} = setup();
    fireEvent.keyDown(field, {key: 'c', code: 'KeyC'});
    fireEvent.keyDown(field, {key: 'Enter', code: 'NumpadEnter', location: 3});
    expect(onSave).toHaveBeenCalledExactlyOnceWith('KeyC');
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('slideHotKeyPress', () => {
  it.each([
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'ControlRight',
    'AltLeft',
    'AltRight',
    'MetaLeft',
    'MetaRight',
  ])('ignores standalone %s without invalidating the draft', code => {
    expect(slideHotKeyPress(new KeyboardEvent('keydown', {code}))).toEqual({
      kind: 'ignore',
    });
  });
  it.each(['Control', 'Alt', 'Shift', 'Meta'])(
    'rejects %s-modified letters and removal',
    modifier => {
      const option = {
        ctrlKey: modifier === 'Control',
        altKey: modifier === 'Alt',
        shiftKey: modifier === 'Shift',
        metaKey: modifier === 'Meta',
      };
      for (const code of ['KeyC', 'Backspace', 'Delete']) {
        expect(
          slideHotKeyPress(new KeyboardEvent('keydown', {code, ...option})),
        ).toEqual({kind: 'reject'});
      }
    },
  );

  it.each(['F1', 'F7', 'Space', 'ArrowRight'])(
    'rejects the reserved %s key',
    code => {
      expect(slideHotKeyPress(new KeyboardEvent('keydown', {code}))).toEqual({
        kind: 'reject',
      });
    },
  );

  it.each(['Tab', 'Enter', 'NumpadEnter', 'Escape'])(
    'passes dialog navigation %s',
    code => {
      expect(slideHotKeyPress(new KeyboardEvent('keydown', {code}))).toEqual({
        kind: 'pass',
      });
    },
  );

  it('normalizes a numpad digit only with Num Lock', () => {
    const event = new KeyboardEvent('keydown', {code: 'Numpad1', key: '1'});
    expect(slideHotKeyPress(event)).toEqual({kind: 'reject'});
    Object.defineProperty(event, 'getModifierState', {
      value: (name: string) => name === 'NumLock',
    });
    expect(slideHotKeyPress(event)).toEqual({kind: 'record', code: 'Digit1'});
  });
});
