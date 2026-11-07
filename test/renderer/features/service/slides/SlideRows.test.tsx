import {useRef, useState} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createServiceItemId, createSlideId} from '@core/schema/ids';
import {SlidesDraft, newSlidesItem} from '@core/services/slidesEdits';
import {SlideRows} from '@renderer/features/service/slides/SlideRows';

afterEach(cleanup);
function makeDraft(
  form: 'ad' | 'blank' = 'blank',
  clipboard?: SlidesDraft['clipboard'],
) {
  const item = newSlidesItem(
    form,
    createServiceItemId('10000000-0000-4000-8000-000000000001'),
  );
  return new SlidesDraft(
    {
      ...item,
      slides: {
        ...item.slides,
        slides: [1, 2, 3, 4].map(n => ({
          id: createSlideId(`00000000-0000-4000-8000-00000000000${n}`),
          text: `Line ${n}`,
          ...(form === 'ad' ? {name: `Ad ${n}`} : {}),
        })),
      },
    },
    clipboard,
  );
}
function Harness({
  draft,
  blocked = false,
  report = vi.fn(),
}: {
  draft: SlidesDraft;
  blocked?: boolean;
  report?: (text: string) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [, refresh] = useState(0);
  const update = () => refresh(n => n + 1);
  return (
    <SlideRows
      draft={draft}
      blocked={blocked}
      report={report}
      update={update}
      list={list}
      renderRow={slide => (
        <textarea
          aria-label="글"
          value={'text' in slide ? slide.text : ''}
          onChange={() => undefined}
        />
      )}
    >
      <button>글 추가</button>
    </SlideRows>
  );
}
const rows = () => [
  ...document.querySelectorAll<HTMLElement>('[data-slide-id]'),
];
const selected = () => rows().filter(row => row.hasAttribute('data-selected'));
function row(index: number) {
  const found = rows()[index];
  if (!found) throw new Error('Missing row');
  return found;
}
function keys(
  key: string,
  options: {ctrlKey?: boolean; shiftKey?: boolean; isComposing?: boolean} = {},
) {
  fireEvent.keyDown(document.activeElement ?? row(0), {
    key,
    code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
    ...options,
  });
}
function clipboard() {
  const data = new Map<string, string>();
  return {
    getData: (type: string) => data.get(type) ?? '',
    setData: (type: string, text: string) => {
      data.set(type, text);
    },
  };
}

describe('slide row editing surface', () => {
  it('selects ranges and toggles individual rows without changing the anchor on pointer focus', async () => {
    render(<Harness draft={makeDraft()} />);
    const user = userEvent.setup();
    await user.click(row(1));
    await user.keyboard('{Shift>}');
    await user.click(row(3));
    await user.keyboard('{/Shift}');
    expect(selected()).toEqual([row(1), row(2), row(3)]);
    await user.keyboard('{Control>}');
    await user.click(row(2));
    await user.keyboard('{/Control}');
    expect(selected()).toEqual([row(1), row(3)]);
    keys('a', {ctrlKey: true});
    expect(selected()).toHaveLength(4);
    keys('Escape');
    expect(selected()).toHaveLength(0);
  });

  it('moves gap carets, extends ranges with arrows, and pastes readable song lines at the caret', () => {
    const draft = makeDraft();
    render(<Harness draft={draft} />);
    fireEvent.click(screen.getByRole('button', {name: '2번째 위치에 삽입'}));
    expect(selected()).toHaveLength(0);
    keys('ArrowDown');
    expect(draft.snapshot.selection.caret).toBe(2);
    keys('ArrowDown', {shiftKey: true});
    expect(selected()).toEqual([row(2)]);
    keys('ArrowUp', {shiftKey: true});
    expect(draft.snapshot.selection.caret).toBe(2);
    const data = clipboard();
    data.setData('text/plain', 'Song line\nSecond line\n\nNext slide');
    fireEvent.paste(document.activeElement ?? row(0), {clipboardData: data});
    expect(draft.snapshot.item.slides.slides[2]).toMatchObject({
      text: 'Song line\nSecond line',
    });
    expect(rows()).toHaveLength(6);
    keys('z', {ctrlKey: true});
    expect(rows()).toHaveLength(4);
    expect(draft.snapshot.selection.caret).toBe(2);
  });

  it.each(['blank', 'ad'] as const)(
    'copies and cuts %s rows, pastes into another item, and undoes as one command',
    form => {
      const source = makeDraft(form);
      const view = render(<Harness draft={source} />);
      fireEvent.click(row(1));
      fireEvent.click(row(3), {ctrlKey: true});
      const data = clipboard();
      fireEvent.copy(row(3), {clipboardData: data});
      expect(data.getData('text/plain')).toBe('Line 2\n\nLine 4');
      const ids = [...source.snapshot.selection.ids];
      fireEvent.cut(row(3), {clipboardData: data});
      expect(rows()).toHaveLength(2);
      expect(document.activeElement).toBe(screen.getByRole('group'));
      keys('z', {ctrlKey: true});
      expect(rows()).toHaveLength(4);
      expect([...source.snapshot.selection.ids]).toEqual(ids);
      view.unmount();
      const target = makeDraft(form, source.clipboard);
      render(<Harness draft={target} />);
      fireEvent.click(screen.getByRole('button', {name: '1번째 위치에 삽입'}));
      fireEvent.paste(document.activeElement ?? row(0), {clipboardData: data});
      expect(rows()).toHaveLength(6);
      expect(target.snapshot.item.slides.slides[0]).toMatchObject({
        text: 'Line 2',
        ...(form === 'ad' ? {name: 'Ad 2'} : {}),
      });
      expect(
        target.snapshot.item.slides.slides
          .slice(0, 2)
          .every(slide => !ids.includes(slide.id)),
      ).toBe(true);
    },
  );

  it('duplicates and deletes the selection, retains keyboard focus when empty, and undoes/redoes', () => {
    render(<Harness draft={makeDraft()} />);
    fireEvent.click(row(1));
    keys('d', {ctrlKey: true});
    expect(rows()).toHaveLength(5);
    keys('z', {ctrlKey: true});
    expect(rows()).toHaveLength(4);
    keys('y', {ctrlKey: true});
    expect(rows()).toHaveLength(5);
    keys('a', {ctrlKey: true});
    keys('Delete');
    expect(rows()).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('group'));
    keys('z', {ctrlKey: true});
    expect(rows()).toHaveLength(5);
  });

  it('moves the whole disjoint selection to a gap without replacing identities', () => {
    const draft = makeDraft();
    render(<Harness draft={draft} />);
    const ids = draft.snapshot.item.slides.slides.map(slide => slide.id);
    fireEvent.click(row(1));
    fireEvent.click(row(3), {ctrlKey: true});
    expect(fireEvent.mouseDown(row(1), {button: 0})).toBe(true);
    expect(selected()).toHaveLength(2);
    const dataTransfer = clipboard();
    fireEvent.dragStart(row(1), {dataTransfer});
    fireEvent.drop(screen.getByRole('button', {name: '1번째 위치에 삽입'}), {
      dataTransfer,
    });
    expect(draft.snapshot.item.slides.slides.map(slide => slide.id)).toEqual([
      ids[1],
      ids[3],
      ids[0],
      ids[2],
    ]);
    keys('z', {ctrlKey: true});
    expect(draft.snapshot.item.slides.slides.map(slide => slide.id)).toEqual(
      ids,
    );
  });

  it('preserves multi-selection on right-click and exposes undo, redo and clipboard shortcuts', async () => {
    render(<Harness draft={makeDraft()} />);
    fireEvent.click(row(1));
    fireEvent.click(row(3), {ctrlKey: true});
    fireEvent.contextMenu(row(1));
    expect(selected()).toHaveLength(2);
    for (const name of [
      /잘라내기.*Ctrl X/,
      /복사.*Ctrl C/,
      /붙여넣기.*Ctrl V/,
      /실행 취소.*Ctrl Z/,
      /다시 실행.*Ctrl Y/,
    ]) {
      expect(screen.getByRole('menuitem', {name})).not.toBeNull();
    }
    await userEvent.click(screen.getByRole('menuitem', {name: /복제/}));
    expect(rows()).toHaveLength(6);
    expect(selected()).toEqual([row(4), row(5)]);
    keys('Delete');
    expect(rows()).toHaveLength(4);
  });

  it('leaves text clipboard and IME keys native and refuses all edits while blocked', () => {
    const draft = makeDraft();
    const view = render(<Harness draft={draft} />);
    const input = screen.getAllByRole('textbox')[0];
    if (!input) throw new Error('Missing input');
    act(() => input.focus());
    const data = clipboard();
    data.setData('text/plain', 'Native');
    expect(fireEvent.copy(input, {clipboardData: data})).toBe(true);
    expect(fireEvent.paste(input, {clipboardData: data})).toBe(true);
    fireEvent.keyDown(input, {key: 'Delete'});
    expect(rows()).toHaveLength(4);
    fireEvent.click(row(0));
    keys('Delete', {isComposing: true});
    expect(rows()).toHaveLength(4);
    view.rerender(<Harness draft={draft} blocked />);
    keys('d', {ctrlKey: true});
    fireEvent.cut(row(0), {clipboardData: data});
    fireEvent.paste(row(0), {clipboardData: data});
    expect(rows()).toHaveLength(4);
    expect(draft.dirty).toBe(false);
  });
});
