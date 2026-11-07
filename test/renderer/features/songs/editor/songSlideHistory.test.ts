import {describe, expect, it, vi} from 'vitest';
import {editorDeckSong} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {SongSlideHistory} from '@renderer/features/songs/editor/songSlideHistory';
import {SlideListClipboard} from '@renderer/features/songs/editor/slideListModel';
import type {SongSlide} from '@core/schema/song';
import {SongSession} from '@renderer/features/songs/editor/songSession';

describe('song rows using shared slide history', () => {
  it('keeps item selection and undo when unrelated service fields advance the accepted revision', async () => {
    const document = editorDeckSong(1);
    const session = new SongSession({
      document,
      api: {
        edit: async () => ({
          ok: true,
          value: {id: document.song.id, revision: document.revision + 1},
        }),
      },
      itemSession: true,
      persistence: 'manual',
      changed: vi.fn(),
      problem: vi.fn(),
    });
    const model = session.history.model;
    const before = session.history.snapshot.song.slides;
    session.commandSlides({type: 'duplicate'});
    expect(await session.commit()).toBe(true);
    const selection = model.getSnapshot().selection;
    session.receive({
      ...session.document,
      revision: session.document.revision + 1,
    });
    expect(session.history.model).toBe(model);
    expect(model.getSnapshot().selection).toBe(selection);
    session.edit('undo');
    expect(session.history.snapshot.song.slides).toEqual(before);
    session.discard();
  });
  it('coalesces typing and restores the text caret around structural edits in one history', () => {
    const history = new SongSlideHistory(editorDeckSong(3).song);
    history.select({block: 1, start: 0, end: 0});
    const original = history.snapshot;
    history.apply({type: 'text', text: 'a', start: 1, end: 1}, 1000);
    history.apply({type: 'text', text: 'ab', start: 2, end: 2}, 1500);
    history.model.command({type: 'duplicate'});
    expect(history.snapshot.song.slides).toHaveLength(4);
    history.undo();
    expect(history.snapshot.song.slides).toHaveLength(3);
    expect(history.snapshot.selection).toEqual({block: 1, start: 2, end: 2});
    history.undo();
    expect(history.snapshot).toEqual(original);
    history.redo();
    expect(history.snapshot.song.slides[1]?.lines).toEqual(['ab']);
  });

  it('shares labels and fresh copies across song sessions through the same clipboard model', () => {
    const clipboard = new SlideListClipboard<SongSlide>();
    const source = new SongSlideHistory(editorDeckSong(3).song, clipboard);
    const song = editorDeckSong(1).song;
    const destination = new SongSlideHistory(
      {...song, slides: song.slides.slice(0, 1)},
      clipboard,
    );
    const slides = source.snapshot.song.slides;
    const first = slides[0];
    const last = slides[2];
    if (!first || !last) throw new Error('Missing fixture slides');
    source.model.select({type: 'click', id: first.id});
    source.model.select({type: 'click', id: last.id, shift: true});
    source.model.command({type: 'label', label: 'Shared'});
    const copied = source.model.copy();
    expect(copied).toMatchObject({ok: true});
    destination.model.select({type: 'gap', index: 0});
    if (!copied.ok || copied.value === null) {
      throw new Error('Missing clipboard');
    }
    destination.model.pasteText(copied.value.replaceAll('\n', '\r\n'));
    const pasted = destination.snapshot.song.slides.slice(0, 3);
    expect(pasted.map(slide => slide.label)).toEqual([
      'Shared',
      'Shared',
      'Shared',
    ]);
    expect(pasted.map(slide => slide.id)).not.toEqual(
      slides.map(slide => slide.id),
    );
    destination.undo();
    expect(destination.snapshot.song.slides).toHaveLength(1);
    expect(destination.model.getSnapshot().selection.caret).toBe(0);
    source.undo();
    expect(source.snapshot.song.slides).toEqual(slides);
  });

  it('splits and merges text through the shared history without losing slide identities', () => {
    const song = editorDeckSong(2).song;
    const history = new SongSlideHistory({
      ...song,
      slides: song.slides.slice(0, 2),
    });
    const original = history.snapshot.song.slides;
    history.select({block: 0, start: 1, end: 1});
    history.apply({type: 'split'});
    expect(history.snapshot.song.slides).toHaveLength(3);
    history.apply({type: 'merge'});
    expect(history.snapshot.song.slides).toHaveLength(2);
    history.undo();
    history.undo();
    expect(history.snapshot.song.slides).toEqual(original);
  });
});
