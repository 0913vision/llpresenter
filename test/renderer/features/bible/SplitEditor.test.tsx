import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {
  SplitEditor,
  type SplitEditorProps,
} from '@renderer/features/bible/SplitEditor';
import {mockSplitLayout} from '@fixtures/core/bibleSplit';
import {themeElementBase} from '@fixtures/core/themeOutput';
import {lookupRequest} from '@fixtures/core/bibleLookups';

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
    ).toContain('1/2');
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

  it('confirms only fitting parts, blocks held confirm keys, and renders the smaller marker', async () => {
    const view = setup();
    expect(
      screen.getByRole('button', {name: '확정'}).hasAttribute('disabled'),
    ).toBe(false);
    const preview = screen.getByRole('img', {name: '슬라이드 1'});
    expect(preview.querySelector<HTMLElement>('span')?.style.fontSize).toBe(
      '28px',
    );
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
    expect(screen.getByText('2/1줄')).not.toBeNull();
  });
});
