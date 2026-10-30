import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {serializeShortcuts, type KeyBinding} from '@core/schema/shortcuts';
import {useClearKeys} from '@renderer/show/clearKeys';
import {useUiZoomKeys} from '@renderer/shell/uiZoomKeys';
import {ShortcutField} from './ShortcutField';
import {Dialog} from './Dialog';
import {SHORTCUT_RECORDING_SELECTOR} from './shortcutRecording';
import {shortcutNames} from './shortcutKeys';
import {hoverForTooltip, resetTooltips} from './tooltipTesting';

vi.mock('@renderer/state/clear', () => ({clearLayer: vi.fn()}));
import {clearLayer} from '@renderer/state/clear';

afterEach(() => {
  resetTooltips();
  delete window.llp;
});

function setup() {
  const onRecord = vi.fn<(binding: KeyBinding | null) => void>();
  const onCancel = vi.fn();
  render(
    <ShortcutField
      aria-label="단축키"
      onRecord={onRecord}
      onCancel={onCancel}
    />,
  );
  const field = screen.getByRole('textbox', {name: '단축키'});
  return {field, onRecord, onCancel};
}

describe('ShortcutField', () => {
  it('marks a mounted session before its first focus notification', () => {
    const onRecord = vi.fn();
    render(
      <ShortcutField
        aria-label="단축키"
        autoFocus={false}
        onRecord={onRecord}
        onCancel={vi.fn()}
      />,
    );
    const field = screen.getByRole('textbox');
    expect(document.activeElement).not.toBe(field);
    expect(field.closest(SHORTCUT_RECORDING_SELECTOR)).toBe(field);
    fireEvent.keyDown(field, {code: 'F1'});
    expect(onRecord).toHaveBeenCalledExactlyOnceWith({code: 'F1', mods: []});
  });

  it('takes Enter and Esc before a dialog and leaves its Tab cycle intact', async () => {
    const dialogCancel = vi.fn();
    const primary = vi.fn();
    const cancelRecording = vi.fn();
    render(
      <Dialog
        title="단축키 설정"
        size="s"
        onCancel={dialogCancel}
        primary={{label: '저장', onSelect: primary}}
      >
        <ShortcutField
          aria-label="단축키"
          onRecord={vi.fn()}
          onCancel={cancelRecording}
        />
      </Dialog>,
    );
    await userEvent.keyboard('{Enter}');
    expect(primary).not.toHaveBeenCalled();
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '닫기'}),
    );
    expect(cancelRecording).toHaveBeenCalledOnce();
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    expect(cancelRecording).toHaveBeenCalledTimes(2);
    expect(dialogCancel).not.toHaveBeenCalled();
  });

  it.each(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7'])(
    'takes %s before the real clear capture handler',
    code => {
      function CaptureKeys() {
        useClearKeys();
        return null;
      }
      render(<CaptureKeys />);
      const {field, onRecord, onCancel} = setup();
      expect(field.closest(SHORTCUT_RECORDING_SELECTOR)).toBe(field);
      expect(fireEvent.keyDown(field, {code})).toBe(false);
      expect(onRecord).toHaveBeenCalledExactlyOnceWith({code, mods: []});
      expect(clearLayer).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
      expect(field.closest(SHORTCUT_RECORDING_SELECTOR)).toBeNull();
    },
  );

  it('takes a zoom chord before the real window capture handler', () => {
    const changeZoom = vi.fn();
    window.llp = fakeLlpApi({ui: {changeZoom}});
    function ZoomKeys() {
      useUiZoomKeys();
      return null;
    }
    render(<ZoomKeys />);
    const {field, onRecord} = setup();
    fireEvent.keyDown(field, {code: 'Equal', ctrlKey: true});
    expect(onRecord).toHaveBeenCalledExactlyOnceWith({
      code: 'Equal',
      mods: ['ctrl'],
    });
    expect(changeZoom).not.toHaveBeenCalled();
  });

  it('records physical codes with canonical modifier order despite a Korean key', () => {
    const {field, onRecord} = setup();
    fireEvent.keyDown(field, {
      code: 'KeyC',
      key: 'ㅊ',
      ctrlKey: true,
      altKey: true,
      shiftKey: true,
    });
    expect(onRecord).toHaveBeenCalledExactlyOnceWith({
      code: 'KeyC',
      mods: ['ctrl', 'alt', 'shift'],
    });
    expect(
      shortcutNames({code: 'KeyC', mods: ['ctrl', 'alt', 'shift']}),
    ).toEqual(['Ctrl', 'Alt', 'Shift', 'C']);
  });

  it('cancels Esc without changing the binding or reaching its parent', () => {
    const outer = vi.fn();
    const onCancel = vi.fn();
    const onRecord = vi.fn();
    render(
      <div onKeyDown={outer}>
        <ShortcutField
          aria-label="단축키"
          onRecord={onRecord}
          onCancel={onCancel}
        />
      </div>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), {code: 'Escape'});
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onRecord).not.toHaveBeenCalled();
    expect(outer).not.toHaveBeenCalled();
  });

  it('removes on bare Backspace and finishes once even after a blur', () => {
    const {field, onRecord, onCancel} = setup();
    fireEvent.keyDown(field, {code: 'Backspace'});
    fireEvent.blur(field);
    expect(onRecord).toHaveBeenCalledExactlyOnceWith(null);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'lets native Tab traversal finish before cancellation, shift=%s',
    async shift => {
      const onCancel = vi.fn();
      const onRecord = vi.fn();
      render(
        <>
          <button>이전</button>
          <ShortcutField
            aria-label="단축키"
            onRecord={onRecord}
            onCancel={onCancel}
          />
          <button>다음</button>
        </>,
      );
      await userEvent.tab({shift});
      expect(document.activeElement).toBe(
        screen.getByRole('button', {name: shift ? '이전' : '다음'}),
      );
      expect(onCancel).toHaveBeenCalledOnce();
      expect(onRecord).not.toHaveBeenCalled();
    },
  );

  it('allows a caller to unmount at Tab blur without moving focus back', async () => {
    function Session() {
      const [editing, setEditing] = useState(true);
      return (
        <>
          {editing ? (
            <ShortcutField
              aria-label="단축키"
              onRecord={() => setEditing(false)}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <span>없음</span>
          )}
          <button>다음</button>
        </>
      );
    }
    render(<Session />);
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '다음'}),
    );
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it.each<[string, KeyboardEventInit, string]>([
    ['Enter', {}, '확인과 실행에 쓰는 키'],
    ['NumpadEnter', {}, '확인과 실행에 쓰는 키'],
    ['F10', {}, '메뉴 막대에 쓰는 키'],
    ['F10', {shiftKey: true}, '오른쪽 클릭 메뉴에 쓰는 키'],
    ['ContextMenu', {}, '오른쪽 클릭 메뉴에 쓰는 키'],
    ...['KeyX', 'KeyC', 'KeyV', 'KeyA'].map<
      [string, KeyboardEventInit, string]
    >(code => [code, {ctrlKey: true}, '글자 편집에 쓰는 키']),
    ['F4', {altKey: true}, 'Windows가 쓰는 키'],
    ['Tab', {altKey: true}, 'Windows가 쓰는 키'],
    ['Escape', {ctrlKey: true}, 'Windows가 쓰는 키'],
    ['Delete', {ctrlKey: true, altKey: true}, 'Windows가 쓰는 키'],
    ['KeyD', {metaKey: true}, 'Windows가 쓰는 키'],
    ['PrintScreen', {}, 'Windows가 쓰는 키'],
    ['', {}, '입력기에 쓰는 키'],
    ['Lang1', {}, '입력기에 쓰는 키'],
    ['Lang2', {}, '입력기에 쓰는 키'],
    ['KeyC', {isComposing: true, ctrlKey: true}, '입력기에 쓰는 키'],
    ['KeyC', {}, '슬라이드 바로 가기에 쓰는 키'],
    ['Digit1', {}, '슬라이드 바로 가기에 쓰는 키'],
    ['Numpad1', {}, '슬라이드 바로 가기에 쓰는 키'],
    ['Unidentified', {}, '지원하지 않는 키'],
  ])(
    'rejects %s %j, describes the reason, and keeps recording',
    (code, options, reason) => {
      const {field, onRecord, onCancel} = setup();
      expect(fireEvent.keyDown(field, {code, ...options})).toBe(false);
      expect(field.getAttribute('aria-invalid')).toBe('true');
      const id = field.getAttribute('aria-describedby') ?? '';
      expect(document.getElementById(id)?.textContent).toBe(reason);
      expect(document.activeElement).toBe(field);
      expect(field.closest(SHORTCUT_RECORDING_SELECTOR)).toBe(field);
      expect(onCancel).not.toHaveBeenCalled();
      expect(onRecord).not.toHaveBeenCalled();
      fireEvent.keyDown(field, {code: 'F7'});
      expect(onRecord).toHaveBeenCalledExactlyOnceWith({code: 'F7', mods: []});
    },
  );

  it('shows the reserved reason in a tooltip without adding visible prose', async () => {
    const {field} = setup();
    fireEvent.keyDown(field, {code: 'Enter'});
    await hoverForTooltip(field.parentElement ?? field);
    expect(screen.getByRole('tooltip').textContent).toBe(
      '확인과 실행에 쓰는 키',
    );
  });

  it('waits for a nonmodifier and rejects Alt alone only on release', () => {
    const {field, onRecord} = setup();
    fireEvent.keyDown(field, {code: 'AltLeft', altKey: true});
    expect(field.getAttribute('aria-invalid')).toBeNull();
    fireEvent.keyUp(field, {code: 'AltLeft'});
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.keyDown(field, {code: 'ControlLeft', ctrlKey: true});
    fireEvent.keyDown(field, {
      code: 'ShiftLeft',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(onRecord).not.toHaveBeenCalled();
    fireEvent.keyDown(field, {code: 'KeyK', ctrlKey: true, shiftKey: true});
    expect(onRecord).toHaveBeenCalledExactlyOnceWith({
      code: 'KeyK',
      mods: ['ctrl', 'shift'],
    });
  });

  it('ignores held-key repeats and permits a new session after refocusing', () => {
    const {field, onRecord} = setup();
    fireEvent.keyDown(field, {code: 'F1', repeat: true});
    expect(onRecord).not.toHaveBeenCalled();
    fireEvent.keyDown(field, {code: 'F1'});
    fireEvent.keyDown(field, {code: 'F1'});
    expect(onRecord).toHaveBeenCalledTimes(1);
    act(() => field.focus());
    fireEvent.keyDown(field, {code: 'F2'});
    expect(onRecord).toHaveBeenLastCalledWith({code: 'F2', mods: []});
  });

  it.each([
    ['ArrowRight', {}, '→'],
    ['PageDown', {}, 'Page Down'],
    ['Space', {}, 'Space'],
    ['Numpad1', {ctrlKey: true, modifierNumLock: true}, 'Ctrl Num 1'],
    ['Numpad1', {ctrlKey: true, modifierNumLock: false}, 'Ctrl Num 1'],
    ['Backspace', {ctrlKey: true}, 'Ctrl Backspace'],
    ['KeyC', {shiftKey: true}, 'Shift C'],
  ])(
    'produces a storable binding and English names for %s %j',
    (code, options, name) => {
      const {field, onRecord} = setup();
      fireEvent.keyDown(field, {code, ...options});
      const binding = onRecord.mock.calls[0]?.[0];
      if (binding === undefined || binding === null) {
        throw new Error('No binding recorded');
      }
      expect(binding.code).toBe(code);
      expect(shortcutNames(binding).join(' ')).toBe(name);
      expect(
        serializeShortcuts(
          {
            format: 'llsettings.shortcuts',
            schemaVersion: 1,
            bindings: {test: [binding]},
          },
          'shortcuts.json',
        ).ok,
      ).toBe(true);
    },
  );
});
