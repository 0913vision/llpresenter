import {fireEvent, render, screen} from '@testing-library/react';
import {useRef, type JSX} from 'react';
import {expect, it, vi} from 'vitest';
import {useEditorBack} from '@renderer/features/slides/useEditorBack';

function Editor({onBack}: {readonly onBack: () => void}): JSX.Element {
  const root = useRef<HTMLElement>(null);
  useEditorBack(root, onBack);
  return (
    <section ref={root}>
      <button type="button">본문 변경…</button>
      <input aria-label="이름" />
      <div
        data-slide-surface
        tabIndex={0}
        aria-label="슬라이드"
        role="listbox"
      />
    </section>
  );
}

const escape = {key: 'Escape'};

it('leaves the editor from its buttons and after the focus is lost', () => {
  const back = vi.fn();
  render(<Editor onBack={back} />);
  fireEvent.keyDown(screen.getByRole('button'), escape);
  fireEvent.keyDown(document.body, escape);
  expect(back).toHaveBeenCalledTimes(2);
});

it('leaves Esc to a field and to the slides', () => {
  const back = vi.fn();
  render(<Editor onBack={back} />);
  fireEvent.keyDown(screen.getByRole('textbox'), escape);
  fireEvent.keyDown(screen.getByRole('listbox'), escape);
  fireEvent.keyDown(document.body, {...escape, ctrlKey: true});
  expect(back).not.toHaveBeenCalled();
});

it('does nothing while another workspace shows', () => {
  const back = vi.fn();
  render(
    <div inert>
      <Editor onBack={back} />
    </div>,
  );
  fireEvent.keyDown(document.body, escape);
  expect(back).not.toHaveBeenCalled();
});
