import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {
  SplitEditor,
  type SplitEditorProps,
} from '@renderer/features/bible/SplitEditor';
import {mockSplitLayout} from '@fixtures/core/bibleSplit';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import styles from '@renderer/features/bible/SplitEditor.module.css';

vi.mock('@renderer/features/bible/SplitSlidePicture', () => ({
  SplitSlidePicture: () => <div />,
}));

function setup(overrides: Partial<SplitEditorProps> = {}) {
  const layout = mockSplitLayout(10, 1);
  const element = {
    ...themeElementBase(),
    kind: 'currentText' as const,
    frame: {x: 0, y: 0, w: 10, h: 36},
    text: {...themeElementBase().text, size: 36, lineHeight: 1, maxLines: 1},
  };
  const onConfirm = vi.fn(async () => undefined);
  const onCancel = vi.fn();
  const props: SplitEditorProps = {
    verse: {
      reference: {
        translation: lookupRequest().translation,
        book: 43,
        chapter: 3,
        verse: 16,
      },
      text: '가나 다라 마바 사아 자차',
    },
    label: '요한복음 3:16',
    cuts: [2],
    layout,
    element,
    prefix: '',
    position: 0,
    total: 2,
    onConfirm,
    onCancel,
    ...overrides,
  };
  const view = render(<SplitEditor {...props} />);
  return {...view, props, onConfirm, onCancel};
}

function key(
  code: string,
  options: {ctrlKey?: boolean; shiftKey?: boolean; repeat?: boolean} = {},
) {
  fireEvent.keyDown(document.activeElement ?? document.body, {
    key: code === 'KeyA' ? 'ㅁ' : code,
    code,
    ...options,
  });
}

describe('Bible split editor', () => {
  it('shows only a fixed-height pending body and ignores confirmation until ready', () => {
    const view = setup({pending: true});
    expect(screen.getByRole('dialog').style.height).toBe('640px');
    expect(screen.getByRole('status', {name: 'AI 준비 중'})).toBeDefined();
    expect(screen.queryByLabelText('나눈 결과')).toBeNull();
    key('Enter');
    key('Space');
    expect(view.onConfirm).not.toHaveBeenCalled();
    key('Escape');
    expect(view.onCancel).toHaveBeenCalledOnce();
  });

  it('guards keyboard and button confirmation for 400ms only after a displayed spinner', async () => {
    vi.useFakeTimers();
    try {
      const view = setup({pending: true});
      view.rerender(<SplitEditor {...view.props} pending={false} />);
      await act(async () => {
        key('Enter');
        fireEvent.click(screen.getByRole('button', {name: '확정'}));
      });
      expect(view.onConfirm).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(399);
      });
      await act(async () => key('Space'));
      expect(view.onConfirm).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      await act(async () => key('Enter'));
      expect(view.onConfirm).toHaveBeenCalledOnce();
      view.unmount();
      const ready = setup();
      await act(async () => key('Enter'));
      expect(ready.onConfirm).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
  it('keeps the editor open when saving fails', async () => {
    const onConfirm = vi.fn(async () => {
      throw Error('절 나누기 저장 실패');
    });
    setup({onConfirm});
    await act(async () => key('Enter'));
    expect(screen.getByRole('alert').textContent).toBe('절 나누기 저장 실패');
    expect(screen.getByRole('dialog', {name: '절 나누기'})).toBeDefined();
  });
  it('toggles physical gap keys and word clicks, then undoes and redoes without changing text', () => {
    const view = setup();
    expect(
      screen.getByRole('dialog', {name: '절 나누기'}).textContent,
    ).toContain('1 / 2');
    expect(
      screen
        .getByRole('button', {name: 'S에서 자르기'})
        .getAttribute('aria-pressed'),
    ).toBe('true');
    key('KeyA');
    expect(
      screen
        .getByRole('button', {name: 'A에서 자르기'})
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen
        .getByRole('button', {name: 'S에서 자르기'})
        .getAttribute('aria-pressed'),
    ).toBe('false');
    key('KeyZ', {ctrlKey: true});
    expect(
      screen
        .getByRole('button', {name: 'S에서 자르기'})
        .getAttribute('aria-pressed'),
    ).toBe('true');
    key('KeyY', {ctrlKey: true});
    expect(
      screen
        .getByRole('button', {name: 'A에서 자르기'})
        .getAttribute('aria-pressed'),
    ).toBe('true');
    key('Backspace');
    fireEvent.click(screen.getByRole('button', {name: '다라'}));
    expect(
      screen
        .getByRole('button', {name: 'S에서 자르기'})
        .getAttribute('aria-pressed'),
    ).toBe('false');
    expect(view.props.verse.text).toBe('가나 다라 마바 사아 자차');
    key('Escape');
    expect(view.onCancel).toHaveBeenCalledOnce();
  });

  it('confirms only fitting parts, blocks held confirm keys, and shakes overflow without a line count', async () => {
    const view = setup();
    expect(
      screen.getByRole('button', {name: '확정'}).hasAttribute('disabled'),
    ).toBe(false);
    key('Space', {repeat: true});
    expect(view.onConfirm).not.toHaveBeenCalled();
    await act(async () => key('Enter'));
    expect(view.onConfirm).toHaveBeenCalledExactlyOnceWith([2]);
    view.unmount();
    const overflow = setup({cuts: []});
    expect(
      screen.getByRole('button', {name: '확정'}).getAttribute('aria-disabled'),
    ).toBe('true');
    key('Space');
    expect(overflow.onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText(/\d+\/\d+줄/)).toBeNull();
    expect(
      screen
        .getByRole('img', {name: '슬라이드 1'})
        .closest('figure')
        ?.classList.contains(styles.shake ?? 'shake'),
    ).toBe(true);
  });

  it('groups each gap key after its preceding word, including a typed prefix', () => {
    const view = setup();
    const hint = screen.getByRole('button', {name: 'A에서 자르기'});
    expect(hint.parentElement?.className).toBe(styles.group);
    expect(hint.previousElementSibling?.textContent).toBe('가나');
    expect(hint.parentElement?.textContent).toBe('가나 A');
    expect(
      screen
        .getByRole('button', {name: '자차'})
        .parentElement?.querySelector('[aria-pressed]'),
    ).toBeNull();
    view.unmount();
    setup({
      verse: {
        ...view.props.verse,
        text: Array.from({length: 40}, (_, i) => `단어${i}`).join(' '),
      },
    });
    key('KeyA');
    expect(
      screen.getByRole('button', {name: 'AA에서 자르기'}).querySelector('span')
        ?.textContent,
    ).toBe('A');
    expect(
      screen.getByRole('button', {name: 'SA에서 자르기'}).dataset['match'],
    ).toBe('false');
    key('Escape');
    expect(
      screen.getByRole('button', {name: 'SA에서 자르기'}).dataset['match'],
    ).toBe('true');
  });

  it('keeps the same dialog height and centers one or two results, without the automatic label', () => {
    const view = setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.style.height).toBe('640px');
    expect(screen.queryByText('자동')).toBeNull();
    expect(screen.getByLabelText('나눈 결과').dataset['centered']).toBe('true');
    expect(screen.getAllByRole('img')).toHaveLength(2);
    key('KeyS');
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByLabelText('나눈 결과').dataset['centered']).toBe('true');
    for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyF']) key(code);
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(screen.getByLabelText('나눈 결과').dataset['centered']).toBe(
      'false',
    );
    expect(dialog.style.height).toBe('640px');
    view.rerender(<SplitEditor {...view.props} total={1} />);
    expect(screen.queryByText('1 / 2')).toBeNull();
    expect(dialog.style.height).toBe('640px');
  });

  it('jumps to the changed gap row on cut, undo and redo, and preserves scroll for other updates', () => {
    const view = setup({cuts: []});
    const area = screen.getByLabelText('나눈 결과');
    vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockImplementation(
      function (this: HTMLElement) {
        return (
          16 +
          Math.floor(
            Array.from(this.parentElement?.children ?? []).indexOf(this) / 3,
          ) *
            220
        );
      },
    );
    for (const code of ['KeyA', 'KeyS', 'KeyD', 'KeyF']) key(code);
    expect(screen.getAllByRole('img')).toHaveLength(5);
    expect(area.scrollTop).toBe(224);
    area.scrollTop = 0;
    key('Backspace');
    expect(area.scrollTop).toBe(224);
    key('KeyZ', {ctrlKey: true});
    expect(area.scrollTop).toBe(4);
    key('KeyY', {ctrlKey: true});
    expect(area.scrollTop).toBe(224);
    area.scrollTop = 73;
    view.rerender(<SplitEditor {...view.props} position={1} />);
    expect(area.scrollTop).toBe(73);
  });
});
