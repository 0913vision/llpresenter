import {act, fireEvent, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorSong} from './editorFixture';
import {SongEditor} from './SongEditor';
import {editorSetup, lyrics} from './editorTesting';

function cursor(input: HTMLTextAreaElement, start: number, end = start): void {
  act(() => {
    input.focus();
    input.setSelectionRange(start, end);
    fireEvent.select(input);
  });
}

describe('song editor view', () => {
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
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0],
    ).toEqual(first.song.groups.flatMap(group => group.slides)[0]);
    expect(lyrics(2).value).toBe(
      first.song.groups
        .flatMap(group => group.slides)[1]
        ?.lines.join('\n')
        .slice(0, 2),
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
    expect(
      documents
        .get(first.song.id)
        ?.song.groups.flatMap(group => group.slides)[0]
        ?.lines.join('\n'),
    ).toBe(text);
    fireEvent.keyDown(lyrics(), {key: 'ㅈ', code: 'KeyZ', ctrlKey: true});
    expect(lyrics().value).toBe(
      first.song.groups.flatMap(group => group.slides)[0]?.lines.join('\n'),
    );
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

  it('splits at Ctrl Enter, remaps all references, and restores the caret', async () => {
    const {session} = await editorSetup();
    const references = session.history.snapshot.song.arrangements;
    act(() => session.selectArrangement('주일용'));
    cursor(lyrics(2), 2);
    fireEvent.keyDown(lyrics(2), {key: 'Enter', code: 'Enter', ctrlKey: true});
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(3);
    expect(session.arrangementSlides).toEqual([1, 2, 3, 2, 3]);
    expect(session.history.snapshot.song.arrangements).toEqual(references);
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
    expect(session.arrangementSlides).toEqual([1, 2, 3, 4, 2, 3, 4]);
    expect(session.history.snapshot.song.arrangements).toEqual(references);
  });

  it('starts lines, splits on an empty line, and merges with Backspace', async () => {
    const {user} = await editorSetup();
    cursor(lyrics(), lyrics().value.length);
    await user.keyboard('{Enter}');
    expect(
      screen.getAllByRole('textbox', {name: /^\uC2AC\uB77C\uC774\uB4DC /}),
    ).toHaveLength(2);
    expect(lyrics().value.endsWith('\n')).toBe(true);
    await user.keyboard('{Enter}');
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
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides),
    ).toHaveLength(2);
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
    expect(screen.queryByRole('button', {name: '1절'})).toBeNull();
    const before = lyrics().value;
    await user.type(lyrics(), 'x');
    expect(lyrics().value).toBe(before);
  });
});
