import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@shared/schema/ids';
import {parseMediaDocument} from '@shared/schema/mediaEdit';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import {editorFixture} from './editorFixture';
import {editorSetup} from './editorTesting';
import {DUPLICATE_TITLE_REASON, SongTitleDraft} from './songTitle';
import {MediaPicker} from './MediaPicker';

function media(count = 3) {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: Array.from({length: count}, (_, index) => ({
        id: createMediaId(
          `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        ),
        name: `Media ${index + 1}`,
        kind: index === count - 1 ? 'audio' : 'image',
        file: 'sample.png',
        size: 0,
      })),
    },
  });
  if (!parsed.ok) throw new Error('Invalid media fixture');
  return parsed.value;
}

async function setup(count = 3) {
  document.documentElement.style.setProperty('--size-row-menu', '28px');
  const fixture = editorFixture();
  const doc = media(count);
  vi.spyOn(fixture.api.media, 'get').mockResolvedValue(doc);
  const value = await editorSetup(fixture);
  return {...value, media: doc};
}

describe('song title normalization', () => {
  it('finds an existing library title stored with whitespace and decomposed Unicode', async () => {
    const fixture = editorFixture();
    const changed = parseSongDocument({
      ...fixture.second,
      song: {
        ...fixture.second.song,
        title: ` ${fixture.second.song.title.normalize('NFD')} `,
      },
    });
    if (!changed.ok || changed.value === null) {
      throw new Error('Invalid song fixture');
    }
    fixture.pushSong(changed.value);
    const {session, edits} = await editorSetup(fixture);
    act(() => session.editTitle(fixture.second.song.title));
    expect(session.title.reason).toBe(DUPLICATE_TITLE_REASON);
    await act(() => session.flush());
    expect(edits).toHaveLength(0);
  });
  it('checks normalized duplicates while retaining the raw typing draft', () => {
    const duplicate = vi.fn(() => true);
    const draft = new SongTitleDraft('Original', duplicate);
    draft.edit(`  ${'가사'.normalize('NFD')}  `);
    expect(draft.reason).toBe(DUPLICATE_TITLE_REASON);
    expect(duplicate).toHaveBeenLastCalledWith('가사');
    expect(draft.nextValue).toBe('Original');
  });

  it('saves trim plus NFC and retains a newer trailing space through an older reply', async () => {
    const {session, edits} = await setup();
    const raw = `  ${'가사'.normalize('NFD')}  `;
    act(() => session.editTitle(raw));
    await act(() => session.flush());
    expect(edits.at(-1)).toMatchObject({song: {title: '가사'}});
    expect(session.title.value).toBe('가사');
    const draft = new SongTitleDraft('Original');
    draft.edit(raw);
    draft.edit(`${raw} `);
    draft.accept('가사', raw);
    expect(draft.value).toBe(`${raw} `);
    expect(draft.changed).toBe(false);
  });
});

describe('default song background', () => {
  it('saves the newest queued background after the preceding revision is accepted', async () => {
    const {api, session, media, edits, documents, first} = await setup();
    const write = api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    act(() => session.setBackground(media.value.items[0]?.id));
    await waitFor(() => expect(edits).toHaveLength(1));
    act(() => session.setBackground(media.value.items[1]?.id));
    expect(edits).toHaveLength(1);
    release();
    await act(() => session.flush());
    expect(edits).toHaveLength(2);
    expect(edits[1]).toMatchObject({baseRevision: 2});
    expect(documents.get(first.song.id)?.song.background).toBe(
      media.value.items[1]?.id,
    );
  });
  it('chooses an image, preserves it through lyric undo, and deletes the field for none', async () => {
    const {session, media, documents, first} = await setup();
    act(() => session.setBackground(media.value.items[0]?.id));
    await act(() => session.flush());
    expect(documents.get(first.song.id)?.song.background).toBe(
      media.value.items[0]?.id,
    );
    act(() => session.edit({type: 'insert'}));
    await act(() => session.flush());
    act(() => session.edit('undo'));
    await act(() => session.flush());
    expect(session.background).toBe(media.value.items[0]?.id);
    act(() => session.setBackground(undefined));
    await act(() => session.flush());
    expect(
      Object.hasOwn(documents.get(first.song.id)?.song ?? {}, 'background'),
    ).toBe(false);
  });

  it('keeps a large list virtualized and lets End select its last eligible item', async () => {
    const {session, media} = await setup(2001);
    render(
      <MediaPicker
        anchor={screen.getByRole('button', {name: '다음 패널'})}
        items={media.value.items}
        selected={undefined}
        onSelect={value => session.setBackground(value)}
        onClose={() => undefined}
      />,
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
    const listbox = screen.getByRole('listbox');
    const viewport = listbox.firstElementChild;
    if (!(viewport instanceof HTMLElement)) throw new Error('Missing viewport');
    fireEvent.scroll(viewport, {target: {scrollTop: 28000}});
    expect(listbox.getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(listbox, {key: 'End'});
    expect(listbox.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', {name: 'Media 2000'}).id,
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
    fireEvent.keyDown(screen.getByRole('listbox'), {key: 'Enter'});
    await act(() => session.flush());
    expect(session.background).toBe(media.value.items.at(-2)?.id);
  });

  it('does not send a queued background after deletion during an in-flight save', async () => {
    const {api, session, media, edits, first, removeSong} = await setup();
    const write = api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    act(() => session.setBackground(media.value.items[0]?.id));
    await waitFor(() => expect(edits).toHaveLength(1));
    act(() => session.setBackground(media.value.items[1]?.id));
    expect(edits).toHaveLength(1);
    act(() => removeSong(first.song.id));
    release();
    await act(() => session.close());
    expect(edits).toHaveLength(1);
  });
});
