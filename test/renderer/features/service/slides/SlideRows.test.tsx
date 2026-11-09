import {useRef, useState} from 'react';
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createServiceItemId, createSlideId} from '@core/schema/ids';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {SlidesDraft, newSlidesItem} from '@core/services/slidesEdits';
import {SlideRows} from '@renderer/features/service/slides/SlideRows';
import type {LeadingSlideCard} from '@renderer/features/songs/editor/SlideCardRenderer';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';
import {SlidesListSession} from '@renderer/features/service/slides/slidesListSession';

afterEach(() => {
  cleanup();
  seedSlideSurfaceView({});
  useLive.setState({state: null});
});
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
  session,
  leadingCard,
}: {
  draft: SlidesDraft;
  blocked?: boolean;
  report?: (text: string) => void;
  session?: SlidesListSession;
  leadingCard?: LeadingSlideCard;
}) {
  const list = useRef<HTMLDivElement>(null);
  const [, refresh] = useState(0);
  const update = () => refresh(n => n + 1);
  return (
    <SlideRows
      draft={draft}
      leadingCard={leadingCard}
      blocked={blocked}
      report={report}
      session={session}
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
    setDragImage: vi.fn(),
    setData: (type: string, text: string) => {
      data.set(type, text);
    },
  };
}

describe('slide row editing surface', () => {
  it('clears leading-card selection when the edited item changes', async () => {
    const first = makeDraft();
    const second = new SlidesDraft({
      ...first.snapshot.item,
      id: createServiceItemId('20000000-0000-4000-8000-000000000001'),
    });
    const onDelete = vi.fn();
    const leadingCard = {
      label: 'Opening card',
      render: () => <span>Card</span>,
      onDelete,
    };
    const user = userEvent.setup();
    const view = render(<Harness draft={first} leadingCard={leadingCard} />);
    await user.click(screen.getByLabelText('Opening card'));
    expect(
      screen
        .getByRole('group', {
          name: '\uC2AC\uB77C\uC774\uB4DC \uD3B8\uC9D1 \uBA85\uB839',
        })
        .hasAttribute('data-leading-active'),
    ).toBe(true);
    view.rerender(<Harness draft={second} leadingCard={leadingCard} />);
    expect(
      screen
        .getByRole('group', {
          name: '\uC2AC\uB77C\uC774\uB4DC \uD3B8\uC9D1 \uBA85\uB839',
        })
        .hasAttribute('data-leading-active'),
    ).toBe(false);
    await user.keyboard('{Delete}');
    expect(onDelete).not.toHaveBeenCalled();
    view.rerender(<Harness draft={first} leadingCard={leadingCard} />);
    expect(
      screen
        .getByRole('group', {
          name: '\uC2AC\uB77C\uC774\uB4DC \uD3B8\uC9D1 \uBA85\uB839',
        })
        .hasAttribute('data-leading-active'),
    ).toBe(false);
  });

  it.each(['list', 'grid'] as const)(
    'does not drop content above the leading card in %s',
    mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const draft = makeDraft();
      const ids = draft.snapshot.item.slides.slides.map(slide => slide.id);
      render(
        <Harness
          draft={draft}
          leadingCard={{
            label: '\uAD6C\uC5ED \uC774\uB984',
            render: () => <span>Card</span>,
            onDelete: vi.fn(),
          }}
        />,
      );
      const card = screen.getByLabelText('\uAD6C\uC5ED \uC774\uB984');
      const dataTransfer = clipboard();
      fireEvent.dragStart(row(1), {dataTransfer});
      fireEvent.drop(card, {dataTransfer});
      expect(draft.snapshot.item.slides.slides.map(slide => slide.id)).toEqual(
        ids,
      );
    },
  );

  it.each(['list', 'grid'] as const)(
    'selects and deletes an item-owned leading card in %s',
    async mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const draft = makeDraft();
      const onDelete = vi.fn();
      const onSelectChange = vi.fn();
      const user = userEvent.setup();
      render(
        <Harness
          draft={draft}
          leadingCard={{
            label: '\uAD6C\uC5ED \uC774\uB984',
            render: current => <span>{`Card ${current}`}</span>,
            onDelete,
            onSelectChange,
          }}
        />,
      );
      const card = screen.getByLabelText('\uAD6C\uC5ED \uC774\uB984');
      expect(card.textContent).toContain(`Card ${mode}`);
      expect(card.getAttribute('draggable')).not.toBe('true');
      expect(draft.snapshot.item.slides.slides).toHaveLength(4);
      await user.click(card);
      expect(onSelectChange).toHaveBeenCalledWith(true);
      await user.keyboard('{Delete}');
      expect(onDelete).toHaveBeenCalledOnce();
      expect(draft.snapshot.item.slides.slides).toHaveLength(4);
      await user.click(row(0));
      await user.keyboard('{ArrowUp}');
      expect(onSelectChange).toHaveBeenLastCalledWith(true);
    },
  );

  it('does not mark the live slide in preparation', () => {
    const draft = makeDraft();
    const state = emptyLiveState();
    useLive.setState({
      state: {
        ...state,
        layers: {
          ...state.layers,
          slide: {
            itemId: draft.snapshot.item.id,
            position: 0,
            label: null,
            lines: [],
          },
        },
      },
    });
    render(<Harness draft={draft} />);
    expect(row(0).hasAttribute('data-live')).toBe(false);
  });

  it('tabs through editable fields without stopping at any slide checkbox', async () => {
    render(<Harness draft={makeDraft()} />);
    const user = userEvent.setup();
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => surface.focus());
    const fields = screen.getAllByRole('textbox', {name: '글'});
    for (const field of fields) {
      await user.tab();
      expect(document.activeElement).toBe(field);
    }
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '글 추가'}),
    );
    for (const field of [...fields].reverse()) {
      await user.tab({shift: true});
      expect(document.activeElement).toBe(field);
    }
    await user.tab({shift: true});
    expect(document.activeElement).toBe(surface);
  });

  it('toggles the list checkbox and focused slide without Ctrl', async () => {
    render(<Harness draft={makeDraft()} />);
    const user = userEvent.setup();
    await user.click(row(0));
    const box = screen.getByRole('checkbox', {name: '슬라이드 2 선택'});
    await user.click(box);
    expect(selected()).toEqual([row(0), row(1)]);
    await user.keyboard(' ');
    expect(selected()).toEqual([row(0)]);
    expect(document.activeElement).toBe(box);
    await user.keyboard(' ');
    expect(selected()).toEqual([row(0), row(1)]);
    await user.click(row(1));
    expect(selected()).toEqual([row(1)]);
    await user.keyboard(' ');
    expect(selected()).toHaveLength(0);
    await user.keyboard(' ');
    expect(selected()).toEqual([row(1)]);
  });

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

  it.each(['list', 'grid'] as const)(
    'duplicates and deletes in %s, retaining keyboard focus',
    mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
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
      fireEvent.click(screen.getByRole('button', {name: '삭제'}));
      expect(rows()).toHaveLength(0);
      expect(document.activeElement).toBe(screen.getByRole('group'));
      keys('z', {ctrlKey: true});
      expect(rows()).toHaveLength(5);
    },
  );

  it('reports a stale group deletion to the slides session notification channel', () => {
    const draft = makeDraft();
    const report = vi.fn();
    const session = new SlidesListSession(draft, {
      locked: () => false,
      problem: vi.fn(),
      report,
    });
    render(<Harness draft={draft} session={session} />);
    fireEvent.click(row(1));
    fireEvent.click(row(3), {ctrlKey: true});
    keys('Delete');
    expect(screen.getByRole('alertdialog')).toBeDefined();
    act(() => session.selectSlides({type: 'clear'}));
    fireEvent.click(screen.getByRole('button', {name: '삭제'}));
    expect(rows()).toHaveLength(4);
    expect(report).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        key: 'selection-delete:stale',
        kind: 'info',
      }),
    );
  });

  it.each(['list', 'grid'] as const)(
    'moves the disjoint selection in %s without replacing identities',
    mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
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
    },
  );

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
    fireEvent.click(screen.getByRole('button', {name: '삭제'}));
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
