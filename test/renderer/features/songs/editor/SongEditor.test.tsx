import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongEditor} from '@renderer/features/songs/editor/SongEditor';
import {seedSlideSurfaceView} from '@renderer/features/songs/editor/SlideSurfaceView';
import {
  editorSetup,
  lyrics,
} from '@fixtures/renderer/features/songs/editor/editorTesting';

function cursor(input: HTMLTextAreaElement, start: number, end = start): void {
  act(() => {
    input.focus();
    input.setSelectionRange(start, end);
    fireEvent.select(input);
  });
}

describe('song editor view', () => {
  it('places the view switch and grid size control in the slide footer', async () => {
    seedSlideSurfaceView({});
    const {user} = await editorSetup();
    const toolbar = screen.getByRole('toolbar', {
      name: '\uC2AC\uB77C\uC774\uB4DC \uBCF4\uAE30',
    });
    const footer = toolbar.closest('footer');
    expect(footer).not.toBeNull();
    expect(footer?.textContent).toContain('2\uAC1C');
    expect(within(toolbar).queryByRole('spinbutton')).toBeNull();
    await user.click(
      within(toolbar).getByRole('button', {name: '\uACA9\uC790'}),
    );
    expect(within(toolbar).getByRole('spinbutton')).toBeDefined();
    seedSlideSurfaceView({});
  });

  it('preserves a native text selection across an unrelated render', async () => {
    const {store, view} = await editorSetup();
    const input = lyrics();
    input.focus();
    input.setSelectionRange(0, input.value.length);
    view.rerender(<SongEditor store={store} addCard={<span>Card</span>} />);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });
  it.each(['list', 'grid'] as const)(
    'keeps both add controls after the slides in %s',
    async mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const {store, view} = await editorSetup();
      view.rerender(
        <SongEditor
          store={store}
          addCard={<button type="button">구역 이름</button>}
        />,
      );
      const slides = view.container.querySelector('[data-editor-block]');
      if (slides === null) throw Error('Missing slide');
      const add = screen.getByRole('button', {name: '슬라이드 추가'});
      const card = screen.getByRole('button', {name: '구역 이름'});
      expect(
        slides.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(add.parentElement).toBe(card.parentElement);
      seedSlideSurfaceView({});
    },
  );
  it.each(['list', 'grid'] as const)(
    'shows an independent leading card before song slides in %s',
    async mode => {
      seedSlideSurfaceView({layout: {normal: {editorSlideView: mode}}});
      const {store, session, user, view} = await editorSetup();
      const onDelete = vi.fn();
      const onSelectChange = vi.fn();
      const count = session.history.snapshot.song.slides.length;
      view.rerender(
        <SongEditor
          store={store}
          leadingCard={{
            label: '\uAD6C\uC5ED \uC774\uB984',
            render: current => <span>{`Card ${current}`}</span>,
            onDelete,
            onSelectChange,
          }}
        />,
      );
      const card = screen.getByLabelText('\uAD6C\uC5ED \uC774\uB984');
      expect(card.textContent).toBe(`Card ${mode}`);
      expect(
        screen.getByRole('textbox', {
          name: '\uC2AC\uB77C\uC774\uB4DC 2 \uAC00\uC0AC',
        }),
      ).toBeDefined();
      await user.click(card);
      await user.keyboard('{Delete}');
      expect(onDelete).toHaveBeenCalledOnce();
      expect(session.history.snapshot.song.slides).toHaveLength(count);
      expect(onSelectChange).toHaveBeenCalledWith(true);
      seedSlideSurfaceView({});
    },
  );

  it('renders a custom card with editable fields in both views', async () => {
    const {store, session, user, view} = await editorSetup();
    const renderCard = (_slide: unknown, index: number, mode: string) =>
      index === 0 ? (
        <input aria-label="Section card" data-mode={mode} defaultValue={mode} />
      ) : undefined;
    view.rerender(<SongEditor store={store} renderCard={renderCard} />);
    expect(screen.getByRole('textbox', {name: 'Section card'})).toHaveProperty(
      'value',
      'list',
    );
    const first = view.container.querySelector<HTMLElement>(
      '[data-editor-block="0"]',
    );
    if (first === null) throw new Error('Missing card row');
    fireEvent.click(first);
    const firstSlide = session.history.snapshot.song.slides[0];
    if (firstSlide === undefined) throw new Error('Missing slide');
    expect(
      session.slideModel.getSnapshot().selection.ids.has(firstSlide.id),
    ).toBe(true);
    await user.click(screen.getByRole('button', {name: '\uACA9\uC790'}));
    const card = screen.getByRole('textbox', {name: 'Section card'});
    expect(card.getAttribute('data-mode')).toBe('grid');
    fireEvent.change(card, {target: {value: 'Edited card'}});
    expect(card).toHaveProperty('value', 'Edited card');
    expect(
      view.container
        .querySelector('[data-editor-block="0"]')
        ?.getAttribute('data-grid'),
    ).toBe('true');
    await user.click(screen.getByRole('button', {name: '\uBAA9\uB85D'}));
  });

  it('edits slide text in both surface views', async () => {
    const {session, user} = await editorSetup();
    const toolbar = screen.getByRole('toolbar', {
      name: '\uC2AC\uB77C\uC774\uB4DC \uBCF4\uAE30',
    });
    fireEvent.change(lyrics(), {target: {value: 'List edit'}});
    await user.click(
      within(toolbar).getByRole('button', {name: '\uACA9\uC790'}),
    );
    expect(lyrics().value).toBe('List edit');
    fireEvent.change(lyrics(), {target: {value: 'Grid edit'}});
    await user.click(
      within(toolbar).getByRole('button', {name: '\uBAA9\uB85D'}),
    );
    expect(lyrics().value).toBe('Grid edit');
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'Grid edit',
    ]);
  });

  it('reports a stale group deletion through the editor notice channel', async () => {
    const {session, onProblem, user} = await editorSetup();
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => session.selectSlides({type: 'all'}));
    act(() => session.commandSlides({type: 'duplicate'}));
    fireEvent.contextMenu(surface);
    await user.click(screen.getByRole('menuitem', {name: /2개 삭제/}));
    expect(screen.getByRole('alertdialog')).toBeDefined();
    act(() => session.selectSlides({type: 'clear'}));
    await user.click(screen.getByRole('button', {name: '삭제'}));
    expect(session.history.snapshot.song.slides).toHaveLength(4);
    expect(onProblem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        key: 'selection-delete:stale',
        kind: 'info',
      }),
    );
  });
  it('tabs from slide commands to label and lyrics, skipping pointer insertion gutters in both directions', async () => {
    const {session, user} = await editorSetup();
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => surface.focus());
    await user.tab();
    const label = document.activeElement;
    expect(
      label?.closest('[data-editor-block]')?.getAttribute('data-editor-block'),
    ).toBe('0');
    expect(label?.hasAttribute('data-slide-gap')).toBe(false);
    expect(label?.tagName).toBe('BUTTON');
    await user.tab();
    expect(document.activeElement).toBe(lyrics());
    await user.tab({shift: true});
    expect(document.activeElement).toBe(label);
    await user.tab({shift: true});
    expect(document.activeElement).toBe(surface);
    await user.keyboard('{Escape}{Home}');
    expect(session.slideModel.getSnapshot().selection.caret).toBe(0);
    await user.keyboard('{End}');
    expect(session.slideModel.getSnapshot().selection.caret).toBe(
      session.slideModel.getSnapshot().slides.length,
    );
    const end = screen.getByRole('button', {name: '마지막 슬라이드 뒤에 삽입'});
    expect(end.tabIndex).toBe(-1);
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    expect(session.slideModel.getSnapshot().selection.caret).toBe(0);
    expect(document.activeElement).toBe(surface);
  });

  it('toggles with the list checkbox and Space while preserving pointer selection modifiers', async () => {
    const {session, user} = await editorSetup();
    const rows = [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    const first = rows[0];
    const second = rows[1];
    if (!first || !second) throw new Error('Missing rows');
    const count = () => session.slideModel.getSnapshot().selection.ids.size;
    await user.click(first);
    const box = screen.getByRole('checkbox', {name: '슬라이드 2 선택'});
    await user.click(box);
    expect(count()).toBe(2);
    expect(box.getAttribute('aria-checked')).toBe('true');
    await user.keyboard(' ');
    expect(count()).toBe(1);
    expect(document.activeElement).toBe(box);
    await user.keyboard(' ');
    expect(count()).toBe(2);
    await user.click(second);
    expect(count()).toBe(1);
    await user.keyboard(' ');
    expect(count()).toBe(0);
    await user.keyboard(' ');
    expect(count()).toBe(1);
    fireEvent.click(first, {shiftKey: true});
    expect(count()).toBe(2);
    fireEvent.click(second, {ctrlKey: true});
    expect(count()).toBe(1);
    await user.click(second);
    expect(count()).toBe(1);
    const input = lyrics(2);
    await user.click(input);
    const length = input.value.length;
    await user.keyboard(' ');
    expect(count()).toBe(1);
    expect(input.value.length).toBe(length + 1);
  });

  it('adds, edits, undoes and deletes a title while keeping repeat insertion available', async () => {
    const {session, user} = await editorSetup();
    const before = session.history.snapshot.song.slides;
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    fireEvent.contextMenu(surface);
    await user.click(
      screen.getByRole('menuitem', {name: '제목 슬라이드 추가'}),
    );
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      titleSlide: true,
      lines: [session.title.nextValue],
    });
    const input = screen.getByRole('textbox', {
      name: '슬라이드 1 제목 및 부제',
    });
    fireEvent.change(input, {target: {value: 'New title\nSubtitle'}});
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      'New title',
      'Subtitle',
    ]);
    fireEvent.contextMenu(surface);
    expect(
      screen
        .getByRole('menuitem', {name: '제목 슬라이드 추가'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
    await user.keyboard('{Escape}');
    act(() => session.edit('undo'));
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual([
      session.title.nextValue,
    ]);
    act(() => session.edit('undo'));
    expect(session.history.snapshot.song.slides).toEqual(before);
    act(() => session.edit('redo'));
    expect(session.history.snapshot.song.slides).toHaveLength(
      before.length + 1,
    );
    act(() => session.commandSlides({type: 'delete'}));
    expect(session.history.snapshot.song.slides).toEqual(before);
  });
  it.each(['number', 'thumbnail', 'margin'])(
    'keeps slide shortcuts active after clicking the row %s from a text field',
    async place => {
      const {session, user} = await editorSetup();
      const row = document.querySelector<HTMLElement>('[data-editor-block]');
      if (row === null) throw new Error('Missing row');
      await user.click(lyrics(2));
      const target =
        place === 'number'
          ? row.querySelector(':scope > span')
          : place === 'thumbnail'
            ? row.querySelector('[data-editor-thumbnail]')
            : row;
      if (!(target instanceof HTMLElement)) throw new Error('Missing target');
      await user.click(target);
      expect(document.activeElement).toBe(
        screen.getByRole('group', {name: '슬라이드 편집 명령'}),
      );
      const original = session.history.snapshot.song.slides;
      await user.keyboard('{Control>}c{/Control}');
      expect(await navigator.clipboard.readText()).toBe(
        original[0]?.lines.join('\n'),
      );
      await user.keyboard('{Control>}d{/Control}');
      expect(session.history.snapshot.song.slides).toHaveLength(
        original.length + 1,
      );
      await user.keyboard('{Delete}');
      expect(session.history.snapshot.song.slides).toEqual(original);
    },
  );

  it('queues repeated paste behind an unfinished copy, with independent ids and one undo per paste', async () => {
    const {session, user} = await editorSetup();
    const original = session.history.snapshot.song.slides;
    const row = document.querySelector<HTMLElement>('[data-editor-block]');
    if (row === null) throw new Error('Missing row');
    fireEvent.click(row);
    let finish: (() => void) | undefined;
    vi.spyOn(navigator.clipboard, 'writeText').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const read = vi
      .spyOn(navigator.clipboard, 'readText')
      .mockResolvedValue(original[0]?.lines.join('\n') ?? '');
    await user.keyboard('{Control>}c{/Control}');
    const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
    act(() => {
      fireEvent.keyDown(surface, {key: 'v', code: 'KeyV', ctrlKey: true});
      fireEvent.keyDown(surface, {key: 'v', code: 'KeyV', ctrlKey: true});
    });
    expect(read).not.toHaveBeenCalled();
    await act(async () => {
      finish?.();
    });
    await waitFor(() =>
      expect(session.history.snapshot.song.slides).toHaveLength(
        original.length + 2,
      ),
    );
    const ids = session.history.snapshot.song.slides.map(slide => slide.id);
    expect(new Set(ids).size).toBe(ids.length);
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(
      original.length + 1,
    );
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(original);
  });

  it('cancels a pending system paste when the operator selects another slide', async () => {
    const {session} = await editorSetup();
    const rows = [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    if (!rows[0] || !rows[1]) throw new Error('Missing rows');
    fireEvent.click(rows[0]);
    const original = session.history.snapshot.song.slides;
    let finish: ((text: string) => void) | undefined;
    vi.spyOn(navigator.clipboard, 'readText').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.keyDown(screen.getByRole('group', {name: '슬라이드 편집 명령'}), {
      key: 'v',
      code: 'KeyV',
      ctrlKey: true,
    });
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.click(rows[1]);
    await act(async () => {
      finish?.('External slide');
    });
    expect(session.history.snapshot.song.slides).toEqual(original);
    expect(session.selectedOccurrence).toBe(1);
  });
  it('selects rows with Shift and Ctrl, then shares duplicate, undo, and gap paste commands', async () => {
    const {session, user} = await editorSetup();
    const rows = (): HTMLElement[] => [
      ...document.querySelectorAll<HTMLElement>('[data-editor-block]'),
    ];
    const first = rows()[0];
    const second = rows()[1];
    if (!first || !second) throw new Error('Missing rows');
    fireEvent.click(first);
    fireEvent.click(second, {shiftKey: true});
    expect(session.history.model.getSnapshot().selection.ids.size).toBe(2);
    expect(rows().filter(row => row.dataset.active === 'true')).toHaveLength(2);
    expect(rows().filter(row => row.dataset.focused === 'true')).toEqual([
      second,
    ]);
    const original = session.history.snapshot.song.slides;
    await user.keyboard('{Control>}d{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(
      original.length + 2,
    );
    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(original);
    fireEvent.click(second, {ctrlKey: true});
    expect(session.history.model.getSnapshot().selection.ids.size).toBe(1);
    await user.keyboard('{Control>}c{/Control}');
    await user.click(
      screen.getByRole('button', {name: '슬라이드 1 앞에 삽입'}),
    );
    expect(session.history.model.getSnapshot().selection.caret).toBe(0);
    await user.keyboard('{Control>}v{/Control}');
    expect(session.history.snapshot.song.slides).toHaveLength(
      original.length + 1,
    );
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(
      original[0]?.lines,
    );
    expect(session.history.snapshot.song.slides[0]?.id).not.toBe(
      original[0]?.id,
    );
  });
  it('passes modified Enter from the title field to window shortcuts', async () => {
    await editorSetup();
    const title = screen.getByRole('textbox', {name: '곡 제목'});
    const keys = vi.fn();
    window.addEventListener('keydown', keys);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      expect(fireEvent.keyDown(title, {key: 'Enter', [modifier]: true})).toBe(
        true,
      );
    }
    window.removeEventListener('keydown', keys);
    expect(keys).toHaveBeenCalledTimes(4);
    expect(fireEvent.keyDown(title, {key: 'Enter'})).toBe(false);
  });

  it('coalesces typing and flushes when the lyrics field loses focus', async () => {
    const {edits} = await editorSetup();
    cursor(lyrics(), 0);
    for (const value of ['a', 'ab', 'abc']) {
      fireEvent.change(lyrics(), {target: {value}});
    }
    expect(edits).toHaveLength(0);
    await act(async () => {
      fireEvent.blur(lyrics());
      await Promise.resolve();
    });
    expect(edits).toHaveLength(1);
  });
  it.each([
    {key: 'Backspace', code: 'Backspace'},
    {key: 'z', code: 'KeyZ', ctrlKey: true},
    {key: 'y', code: 'KeyY', ctrlKey: true},
  ])('allows selection after a no-op $code command', async command => {
    const {session, first} = await editorSetup();
    cursor(lyrics(), 0);
    fireEvent.keyDown(lyrics(), command);
    cursor(lyrics(2), 2);
    fireEvent.keyDown(lyrics(2), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(session.history.snapshot.song.slides[0]).toEqual(
      first.song.slides[0],
    );
    expect(lyrics(2).value).toBe(
      first.song.slides[1]?.lines.join('\n').slice(0, 2),
    );
    expect(document.activeElement).toBe(lyrics(3));
  });
  it('saves input and dispatches physical undo and both redo bindings', async () => {
    const {user, session, documents, first} = await editorSetup();
    await user.click(lyrics());
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1000);
    try {
      await user.keyboard('{End}abc');
    } finally {
      clock.mockRestore();
    }
    await act(() => session.flush());
    const text = lyrics().value;
    expect(documents.get(first.song.id)?.song.slides[0]?.lines.join('\n')).toBe(
      text,
    );
    fireEvent.keyDown(lyrics(), {key: 'ㅈ', code: 'KeyZ', ctrlKey: true});
    expect(lyrics().value).toBe(first.song.slides[0]?.lines.join('\n'));
    fireEvent.keyDown(lyrics(), {key: 'y', code: 'KeyY', ctrlKey: true});
    expect(lyrics().value).toBe(text);
    fireEvent.keyDown(lyrics(), {key: 'z', code: 'KeyZ', ctrlKey: true});
    fireEvent.keyDown(lyrics(), {
      key: 'z',
      code: 'KeyZ',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(lyrics().value).toBe(text);
  });

  it('splits at Ctrl Enter and restores the caret', async () => {
    const {session} = await editorSetup();
    cursor(lyrics(2), 2);
    fireEvent.keyDown(lyrics(2), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(3);
    expect(document.activeElement).toBe(lyrics(3));
    expect(lyrics(3).selectionStart).toBe(0);
    fireEvent.keyDown(lyrics(3), {
      key: 'N',
      code: 'KeyN',
      ctrlKey: true,
      shiftKey: true,
    });
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(4);
    expect(document.activeElement).toBe(lyrics(4));
    expect(lyrics(4).value).toBe('');
    await act(() => session.flush());
  });

  it('starts lines, splits explicitly, and merges with Backspace', async () => {
    const {user} = await editorSetup();
    cursor(lyrics(), lyrics().value.length);
    await user.keyboard('{Enter}');
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(2);
    expect(lyrics().value.endsWith('\n')).toBe(true);
    fireEvent.keyDown(lyrics(), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(3);
    expect(document.activeElement).toBe(lyrics(2));
    await user.keyboard('{Backspace}');
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(2);
    expect(document.activeElement).toBe(lyrics());
    expect(lyrics().selectionStart).toBe(lyrics().value.length);
  });

  it('splits pasted paragraphs and crosses block boundaries with arrow keys', async () => {
    await editorSetup();
    cursor(lyrics(), 0, lyrics().value.length);
    fireEvent.paste(lyrics(), {
      clipboardData: {getData: () => 'first\n\nsecond'},
    });
    expect(lyrics().value).toBe('first');
    expect(lyrics(2).value).toBe('second');
    cursor(lyrics(2), 3);
    fireEvent.keyDown(lyrics(2), {key: 'ArrowUp'});
    expect(document.activeElement).toBe(lyrics());
    expect(lyrics().selectionStart).toBe(3);
    fireEvent.keyDown(lyrics(), {key: 'ArrowDown'});
    expect(document.activeElement).toBe(lyrics(2));
    expect(lyrics(2).selectionStart).toBe(3);
    fireEvent.keyDown(lyrics(2), {key: 'ArrowUp', shiftKey: true});
    expect(document.activeElement).toBe(lyrics(2));
  });

  it.each([{types: ['image/png']}, {types: ['text/plain']}])(
    'keeps selected lyrics when a paste has empty plain text with types $types',
    async ({types}) => {
      const {session, edits} = await editorSetup();
      const input = lyrics();
      const text = input.value;
      const song = session.history.snapshot.song;
      expect(text.length).toBeGreaterThan(2);
      cursor(input, 1, 3);
      fireEvent.paste(input, {clipboardData: {types, getData: () => ''}});
      expect(input.value).toBe(text);
      expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3]);
      expect(session.history.snapshot.song).toBe(song);
      expect(edits).toHaveLength(0);
    },
  );

  it('leaves composition and unrelated modifier commands to their owners', async () => {
    const {session, edits} = await editorSetup();
    cursor(lyrics(), 1);
    fireEvent.compositionStart(lyrics());
    fireEvent.keyDown(lyrics(), {key: 'Enter', code: 'Enter', ctrlKey: true});
    fireEvent.compositionEnd(lyrics());
    fireEvent.keyDown(lyrics(), {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
      isComposing: true,
    });
    fireEvent.keyDown(lyrics(), {key: 'Enter', code: 'Enter', altKey: true});
    fireEvent.keyDown(lyrics(), {key: 'N', code: 'KeyN', ctrlKey: true});
    expect(session.history.snapshot.song.slides).toHaveLength(2);
    expect(edits).toHaveLength(0);
  });

  it('keeps history through view unmounts and protects read-only documents', async () => {
    const {store, session, view, user} = await editorSetup();
    await user.click(lyrics());
    await user.keyboard('a');
    await act(() => session.flush());
    view.rerender(<SongEditor store={store} />);
    expect(session.history.canUndo).toBe(true);
    act(() => store.open(editorSong(5, 'readOnly')));
    expect(lyrics().readOnly).toBe(true);
    expect(screen.queryByRole('button', {name: '1절 1'})).toBeNull();
    const before = lyrics().value;
    await user.type(lyrics(), 'x');
    expect(lyrics().value).toBe(before);
  });
});

it('adds a closing title at the end caret, edits its spacing, duplicates and undoes deletion', async () => {
  const {session, user} = await editorSetup();
  const original = session.history.snapshot.song.slides;
  await user.click(
    screen.getByRole('button', {name: '마지막 슬라이드 뒤에 삽입'}),
  );
  const surface = screen.getByRole('group', {name: '슬라이드 편집 명령'});
  fireEvent.contextMenu(surface);
  await user.click(screen.getByRole('menuitem', {name: '제목 슬라이드 추가'}));
  const closing = session.history.snapshot.song.slides.at(-1);
  expect(closing).toMatchObject({
    titleSlide: true,
    lines: [session.title.nextValue],
  });
  expect(session.history.snapshot.song.slides.slice(0, -1)).toEqual(original);
  const spacing = screen.getByRole('spinbutton', {name: '부제 자간'});
  await user.clear(spacing);
  await user.type(spacing, '12{Enter}');
  expect(session.history.snapshot.song.slides.at(-1)?.titleLayout).toEqual({
    titleTracking: 0,
    subtitleTracking: 12,
  });
  fireEvent.contextMenu(surface);
  await user.click(screen.getByRole('menuitem', {name: /복제/}));
  expect(session.history.snapshot.song.slides.at(-1)).toMatchObject({
    titleSlide: true,
    titleLayout: {titleTracking: 0, subtitleTracking: 12},
  });
  expect(session.history.snapshot.song.slides.at(-1)?.id).not.toBe(closing?.id);
  act(() => surface.focus());
  await user.keyboard('{Delete}');
  expect(session.history.snapshot.song.slides).toHaveLength(
    original.length + 1,
  );
  act(() => session.edit('undo'));
  expect(session.history.snapshot.song.slides).toHaveLength(
    original.length + 2,
  );
});
