import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {parseMediaDocument} from '@core/schema/mediaEdit';
import {parseSongDocument} from '@core/schema/contentDocuments';
import {editorFixture} from './editorFixture';
import {editorSetup, mockMenuRowHeight} from './editorTesting';
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
  mockMenuRowHeight();
  const fixture = editorFixture();
  const doc = media(count);
  vi.spyOn(fixture.api.media, 'get').mockResolvedValue(doc);
  const value = await editorSetup(fixture);
  return {...value, media: doc};
}

function renderPicker(
  items: readonly MediaItem[],
  onSelect: (id: MediaId | undefined) => void = vi.fn(),
) {
  const onClose = vi.fn();
  const anchor = screen.getByRole('button', {name: '다음 패널'});
  function PickerHost() {
    const [query, setQuery] = useState('');
    return (
      <MediaPicker
        anchor={anchor}
        items={items}
        selected={undefined}
        query={query}
        onQueryChange={setQuery}
        onSelect={onSelect}
        onClose={onClose}
      />
    );
  }
  render(<PickerHost />);
  const search = screen.getByRole('combobox', {name: '검색'});
  if (!(search instanceof HTMLInputElement)) throw new Error('Missing search');
  return {
    search,
    listbox: screen.getByRole('listbox', {name: '기본 배경'}),
    onClose,
  };
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
  it('passes modified keys without changing the background or moving the choice', async () => {
    const {media} = await setup();
    const onSelect = vi.fn();
    const {search, listbox, onClose} = renderPicker(
      media.value.items,
      onSelect,
    );
    const active = search.getAttribute('aria-activedescendant');
    const onKeyDown = vi.fn();
    window.addEventListener('keydown', onKeyDown);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey']) {
      fireEvent.keyDown(search, {key: 'ArrowDown', [modifier]: true});
      fireEvent.keyDown(search, {key: 'Enter', [modifier]: true});
    }
    expect(search.getAttribute('aria-activedescendant')).toBe(active);
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    const option = listbox.querySelector<HTMLElement>('[role="option"]');
    if (option === null) throw new Error('Missing option');
    fireEvent.keyDown(option, {key: ' ', ctrlKey: true});
    fireEvent.keyUp(option, {key: ' '});
    fireEvent.click(option, {detail: 0});
    expect(onSelect).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(9);
    window.removeEventListener('keydown', onKeyDown);
    fireEvent.keyDown(search, {key: 'ArrowDown'});
    fireEvent.keyDown(search, {key: 'Enter'});
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(media.value.items[0]?.id);
  });

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

  it('keeps a large list virtualized and lets Up wrap to its last eligible item', async () => {
    const {session, media} = await setup(2001);
    const {search, listbox} = renderPicker(media.value.items, value =>
      session.setBackground(value),
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
    fireEvent.scroll(listbox, {target: {scrollTop: 28000}});
    expect(search.getAttribute('aria-activedescendant')).toBeNull();
    fireEvent.keyDown(search, {key: 'ArrowUp'});
    expect(search.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', {name: 'Media 2000'}).id,
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
    fireEvent.keyDown(search, {key: 'Enter'});
    await act(() => session.flush());
    expect(session.background).toBe(media.value.items.at(-2)?.id);
  });

  it('filters Hangul contains matches across Unicode forms without taking IME keys', async () => {
    const {media} = await setup();
    const items = media.value.items.map((item, index) => ({
      ...item,
      name: (index === 0 ? '푸른 바다' : '하늘 빛').normalize('NFD'),
    }));
    const onSelect = vi.fn();
    const {search, onClose} = renderPicker(items, onSelect);
    expect(document.activeElement).toBe(search);
    fireEvent.compositionStart(search);
    fireEvent.change(search, {target: {value: '바'}});
    fireEvent.keyDown(search, {key: 'Enter', isComposing: true});
    fireEvent.keyDown(search, {key: 'Escape', isComposing: true});
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.compositionEnd(search, {data: '바다'});
    fireEvent.change(search, {
      target: {value: `  ${'바다'.normalize('NFD')}  `},
    });
    expect(
      screen.getAllByRole('option').map(option => option.textContent),
    ).toEqual(['없음', '푸른 바다'.normalize('NFD')]);
    for (const key of ['Home', 'End', ' ']) {
      expect(fireEvent.keyDown(search, {key})).toBe(true);
    }
    fireEvent.keyDown(search, {key: 'Enter'});
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(items[0]?.id);
    expect(onClose).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('moves on the first Down while keeping search editable through typing and Backspace', async () => {
    const user = userEvent.setup();
    const {media} = await setup(4);
    const onSelect = vi.fn();
    const {search, listbox} = renderPicker(media.value.items, onSelect);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', {name: 'Media 1'}).id,
    );
    expect(listbox.getAttribute('aria-activedescendant')).toBeNull();
    await user.keyboard('Media 2');
    expect(search.value).toBe('Media 2');
    expect(search.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', {name: 'Media 2'}).id,
    );
    await user.keyboard('{Backspace}');
    expect(search.value).toBe('Media ');
    await user.keyboard('3{Enter}');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(media.value.items[2]?.id);
  });

  it('resets and navigates the virtual window over the filtered choices', async () => {
    const {media} = await setup(2001);
    const onSelect = vi.fn();
    const {search, listbox} = renderPicker(media.value.items, onSelect);
    fireEvent.keyDown(search, {key: 'ArrowUp'});
    expect(listbox.scrollTop).toBeGreaterThan(0);
    fireEvent.change(search, {target: {value: '  mEDia 1  '}});
    expect(listbox.scrollTop).toBe(0);
    expect(screen.getAllByRole('option')[0]?.textContent).toBe('없음');
    expect(screen.getByRole('option', {name: 'Media 1'})).toBeDefined();
    const matches = media.value.items.filter(
      item => item.kind !== 'audio' && item.name.includes('Media 1'),
    );
    fireEvent.keyDown(search, {key: 'ArrowUp'});
    fireEvent.keyDown(search, {key: 'ArrowUp'});
    const last = screen.getByRole('option', {name: 'Media 1999'});
    expect(search.getAttribute('aria-activedescendant')).toBe(last.id);
    expect(last.getAttribute('aria-posinset')).toBe(String(matches.length + 1));
    expect(last.getAttribute('aria-setsize')).toBe(String(matches.length + 1));
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
    fireEvent.keyDown(search, {key: 'Enter'});
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(matches.at(-1)?.id);
    fireEvent.change(search, {target: {value: 'No matching name'}});
    expect(listbox.scrollTop).toBe(0);
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(search.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', {name: '없음'}).id,
    );
    fireEvent.change(search, {target: {value: '   '}});
    expect(search.getAttribute('aria-activedescendant')).toBe(
      screen.getByRole('option', {name: '없음'}).id,
    );
    fireEvent.keyDown(search, {key: 'ArrowUp'});
    expect(screen.getByRole('option', {name: 'Media 2000'})).toBeDefined();
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
