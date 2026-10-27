import {act, fireEvent, screen} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {editorSetup, lyrics} from './editorTesting';
import {parseSongDocument} from '@shared/schema/contentDocuments';

const COUNT = 5000;
async function largeEditor() {
  const f = await editorSetup();
  act(() =>
    f.store.openImported({
      title: 'Large invented song',
      slides: Array.from({length: COUNT}, (_, index) => ({
        lines: [`Invented ${index}`],
      })),
    }),
  );
  const session = f.store.getSnapshot().session;
  if (session === null) throw new Error('No imported session');
  return {...f, session};
}
function mounted() {
  return screen.getAllByRole('textbox', {name: /^슬라이드 \d+ 가사$/});
}

describe('windowed song editor', () => {
  it('tabs between read-only rows without targeting a missing label picker', async () => {
    const f = await largeEditor();
    const parsed = parseSongDocument({
      ...f.first,
      song: {
        ...f.session.history.snapshot.song,
        id: f.first.song.id,
        title: f.first.song.title,
      },
      revision: 2,
      access: 'readOnly',
    });
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Invalid read-only fixture');
    }
    const document = parsed.value;
    act(() => {
      f.store.discardImported();
      f.pushSong(document);
      f.store.open(document);
    });
    act(() => lyrics().focus());
    for (let index = 1; index < 12; index++) {
      await f.user.tab();
      expect(globalThis.document.activeElement).toBe(lyrics(index + 1));
    }
    await f.user.tab({shift: true});
    expect(globalThis.document.activeElement).toBe(lyrics(11));
    expect(mounted().length).toBeLessThanOrEqual(10);
  });
  it('bounds a large import and reveals its final slide without mounting the whole song', async () => {
    const f = await largeEditor();
    expect(mounted().length).toBeLessThanOrEqual(10);
    act(() => f.session.select({block: COUNT - 1, start: 0, end: 0}));
    expect(lyrics(COUNT).value).toBe(`Invented ${COUNT - 1}`);
    expect(mounted().length).toBeLessThanOrEqual(10);
    fireEvent.change(lyrics(COUNT), {target: {value: 'Edited final slide'}});
    fireEvent.keyDown(lyrics(COUNT), {key: 'z', code: 'KeyZ', ctrlKey: true});
    expect(lyrics(COUNT).value).toBe(`Invented ${COUNT - 1}`);
    expect(f.edits).toHaveLength(0);
  });

  it('moves keyboard focus through visible rows and across windows', async () => {
    await largeEditor();
    act(() => lyrics().focus());
    for (let index = 1; index < 20; index++) {
      fireEvent.keyDown(lyrics(index), {key: 'ArrowDown'});
      expect(document.activeElement).toBe(lyrics(index + 1));
      expect(mounted().length).toBeLessThanOrEqual(10);
    }
    fireEvent.keyDown(lyrics(20), {key: 'ArrowUp'});
    expect(document.activeElement).toBe(lyrics(19));
  });

  it('tabs in logical row order and reverses through the previous window', async () => {
    const f = await largeEditor();
    act(() => lyrics().focus());
    for (let index = 1; index < 12; index++) {
      await f.user.tab();
      expect(
        document.activeElement
          ?.closest('[data-editor-block]')
          ?.getAttribute('data-editor-block'),
      ).toBe(String(index));
      expect(document.activeElement).toBeInstanceOf(HTMLButtonElement);
      await f.user.tab();
      expect(document.activeElement).toBe(lyrics(index + 1));
    }
    await f.user.tab({shift: true});
    await f.user.tab({shift: true});
    expect(document.activeElement).toBe(lyrics(11));
    expect(mounted().length).toBeLessThanOrEqual(10);
  });

  it('retains the active IME field while scrolling a distant window into view', async () => {
    await largeEditor();
    const input = lyrics();
    act(() => input.focus());
    fireEvent.compositionStart(input);
    fireEvent.scroll(screen.getByRole('group', {name: '가사'}), {
      target: {scrollTop: COUNT - 10},
    });
    expect(lyrics(COUNT - 5)).toBeDefined();
    expect(input.isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(mounted().length).toBeLessThanOrEqual(10);
    fireEvent.change(input, {target: {value: '조합 중'}});
    expect(input.isConnected).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('조합 중');
    fireEvent.compositionEnd(input);
  });
});
