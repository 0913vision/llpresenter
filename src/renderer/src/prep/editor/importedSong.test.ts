import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {parseSongDocument} from '@shared/schema/contentDocuments';
import {parseGroupedSongDraft} from '@shared/schema/groupedSong';
import {createMediaId, createSongId} from '@shared/schema/ids';
import type {ContentEdit} from '@shared/schema/contentEdit';
import type {TextImportDraft} from '@shared/schema/textImport';
import {editorFixture} from './editorFixture';
import {SongEditorStore} from './songEditorStore';

const draft: TextImportDraft = {
  title: '',
  slides: [
    {label: 'Invented', lines: ['First invented line']},
    {lines: ['Second invented line']},
  ],
};
function fixture() {
  const f = editorFixture();
  const problem = vi.fn();
  const store = new SongEditorStore(f.api, problem);
  const write = f.api.content.edit;
  const imports: ContentEdit[] = [];
  vi.spyOn(f.api.content, 'edit').mockImplementation(async edit => {
    if (edit.type !== 'song.import') return write(edit);
    imports.push(edit);
    const id =
      edit.target.kind === 'new'
        ? createSongId(
            `00000000-0000-4000-8000-${String(98 + imports.length).padStart(12, '0')}`,
          )
        : edit.target.songId;
    const parsed = parseSongDocument({
      song: {...f.first.song, ...edit.draft, id},
      revision: 2,
      access: 'editable',
    });
    if (!parsed.ok || parsed.value === null) {
      throw new Error('Invalid imported fixture');
    }
    f.pushSong(parsed.value);
    return {ok: true, value: {id, revision: parsed.value.revision}};
  });
  store.openImported(draft);
  const session = store.getSnapshot().session;
  if (session === null) throw new Error('No imported session');
  onTestFinished(() => store.dispose());
  return {...f, store, session, imports, problem};
}

describe('imported song editor sessions', () => {
  it('retains an edited label boundary when migrating an imported section', () => {
    const f = fixture();
    f.store.discardImported();
    f.store.openImported({
      title: 'Invented',
      slides: [
        {label: 'Verse', lines: ['Invented first'], section: 0},
        {label: 'Verse', lines: ['Invented second'], section: 0},
      ],
    });
    const session = f.store.getSnapshot().session;
    if (session === null) throw new Error('No imported session');
    session.select({block: 1, start: 0, end: 0});
    session.edit({type: 'label', name: 'Chorus'});
    const migrated = parseGroupedSongDraft(
      JSON.stringify(session.history.snapshot.song),
      'invented.llsong',
    );
    if (!migrated.ok) throw new Error(migrated.error.message);
    expect(migrated.value.data.groups.map(group => group.name)).toEqual([
      'Verse',
      'Chorus',
    ]);
  });

  it('evicts clean sessions after repeated imports while retaining the active and item songs', async () => {
    const f = fixture();
    f.store.attach(f.first);
    f.store.showItemSong(f.first.song.id);
    const ids = [f.first.song.id];
    for (let index = 0; index < 25; index++) {
      if (index > 0) f.store.openImported(draft);
      f.store.getSnapshot().session?.editTitle(`Imported ${index}`);
      expect(await f.store.saveImported({kind: 'new'})).toBe(true);
      const active = f.store.getSnapshot().session;
      if (active === null) throw new Error('No saved session');
      ids.push(active.document.song.id);
      expect(f.store.sessionOf(active.document.song.id)).toBe(active);
    }
    expect(ids.filter(id => f.store.sessionOf(id) !== undefined)).toHaveLength(
      20,
    );
    expect(f.store.sessionOf(f.first.song.id)).toBeDefined();
    expect(f.store.sessionOf(ids[1] ?? f.first.song.id)).toBeUndefined();
  });

  it('installs an accepted overwrite over a cached session blocked by a stale-save refusal', async () => {
    const f = fixture();
    f.store.discardImported();
    f.store.open(f.first);
    const cached = f.store.getSnapshot().session;
    if (cached === null) throw new Error('No cached target');
    vi.spyOn(f.api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed elsewhere'},
    });
    cached.edit({type: 'text', text: 'Refused local draft', start: 0, end: 0});
    expect(await cached.flush()).toBe(false);
    expect(cached.blocked).toBe(true);
    f.store.openImported({...draft, title: f.first.song.title});
    expect(
      await f.store.saveImported({
        kind: 'overwrite',
        songId: f.first.song.id,
        baseRevision: f.first.revision,
      }),
    ).toBe(true);
    const accepted = f.store.getSnapshot().session;
    expect(accepted).toBe(cached);
    expect(accepted?.history.snapshot.song.slides).toEqual(draft.slides);
    expect(accepted?.readOnly).toBe(false);
    expect(accepted?.history.canUndo).toBe(false);
    expect(accepted?.document.revision).toBe(2);
    accepted?.editTitle('Editable after overwrite');
    expect(await accepted?.flush()).toBe(true);
    expect(f.edits.at(-1)).toMatchObject({
      type: 'song.update',
      song: {title: 'Editable after overwrite'},
    });
  });
  it('keeps title, lyrics, background, undo and arrangements local until Save', async () => {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const f = fixture();
    f.session.finishTitle();
    expect(f.session.title.value).toBe('');
    f.session.setBackground(
      createMediaId('00000000-0000-4000-8000-000000000001'),
    );
    f.session.edit({type: 'text', text: 'Changed', start: 7, end: 7});
    f.session.endTyping();
    f.session.edit('undo');
    f.session.edit('redo');
    const name = f.session.createArrangement();
    if (name === undefined) throw new Error('No arrangement');
    expect(await f.store.renameArrangement(name, 'Imported order')).toBe(true);
    expect(await f.store.renameArrangement('Imported order', '  ')).toBe(false);
    expect(await f.store.deleteArrangement('Imported order')).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await f.session.flush()).toBe(true);
    expect(f.edits).toHaveLength(0);
    expect(f.imports).toHaveLength(0);
    expect(f.session.history.snapshot.song.slides[0]?.lines).toEqual([
      'Changed',
    ]);
    expect(f.store.getSnapshot().imported).toBe(true);
    expect(f.store.sessionOf(f.session.document.song.id)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
    expect(await f.store.flush()).toBe(false);
    expect(f.store.getSnapshot().busy).toBe(false);
  });

  it('retains the draft across library updates and defers navigation until confirmed', async () => {
    const f = fixture();
    await Promise.resolve();
    f.pushList([]);
    expect(f.store.getSnapshot().session).toBe(f.session);
    f.store.open(f.second);
    expect(f.store.getSnapshot().discardRequested).toBe(true);
    expect(f.store.getSnapshot().session).toBe(f.session);
    f.store.cancelDiscard();
    expect(f.store.getSnapshot().discardRequested).toBe(false);
    expect(f.store.getSnapshot().session).toBe(f.session);
    f.store.open(f.second);
    f.store.discardImported();
    expect(f.store.getSnapshot().imported).toBe(false);
    expect(f.store.getSnapshot().session?.document).toEqual(f.second);
    expect(f.imports).toHaveLength(0);
  });

  it('confirms replacement imports and releases the abandoned session', () => {
    const f = fixture();
    f.store.openImported({...draft, title: 'Next import'});
    expect(f.store.getSnapshot().session).toBe(f.session);
    f.store.discardImported();
    expect(f.store.getSnapshot().session?.title.value).toBe('Next import');
    f.session.editTitle('Abandoned');
    expect(f.session.title.value).not.toBe('Abandoned');
    f.store.discardImported();
    expect(f.store.getSnapshot().session).toBeNull();
  });

  it('saves once, accepts the main document and enables normal autosave afterward', async () => {
    const f = fixture();
    f.session.editTitle('Imported title');
    f.session.createArrangement();
    expect(await f.store.saveImported({kind: 'new'})).toBe(true);
    expect(f.imports).toHaveLength(1);
    expect(f.imports[0]).toMatchObject({
      type: 'song.import',
      target: {kind: 'new'},
      draft: {title: 'Imported title', slides: draft.slides},
    });
    const saved = f.store.getSnapshot().session;
    if (saved === null) throw new Error('No saved session');
    expect(f.store.getSnapshot().imported).toBe(false);
    expect(saved).not.toBe(f.session);
    saved.editTitle('Normal autosave');
    expect(await saved.flush()).toBe(true);
    expect(f.edits.at(-1)).toMatchObject({
      type: 'song.update',
      song: {title: 'Normal autosave'},
    });
  });

  it('passes an explicit overwrite revision and retains a refused draft', async () => {
    const f = fixture();
    f.session.editTitle(f.first.song.title);
    const target = {
      kind: 'overwrite',
      songId: f.first.song.id,
      baseRevision: f.first.revision,
    } as const;
    vi.spyOn(f.api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Changed elsewhere'},
    });
    expect(await f.store.saveImported(target)).toBe(false);
    expect(f.store.getSnapshot().session).toBe(f.session);
    expect(f.problem).toHaveBeenCalledOnce();
    expect(await f.store.saveImported(target)).toBe(true);
    expect(f.imports[0]).toMatchObject({target});
    expect(f.store.getSnapshot().session?.document.song.id).toBe(
      f.first.song.id,
    );
  });

  it('retries only reading after an accepted save whose document read failed', async () => {
    const f = fixture();
    f.session.editTitle('Imported title');
    vi.spyOn(f.api.songs, 'get').mockResolvedValueOnce(null);
    expect(await f.store.saveImported({kind: 'new'})).toBe(false);
    expect(f.imports).toHaveLength(1);
    expect(f.session.readOnly).toBe(true);
    f.session.editTitle('Unsafe extra edit');
    expect(f.session.title.value).toBe('Imported title');
    expect(await f.store.saveImported({kind: 'new'})).toBe(true);
    expect(f.imports).toHaveLength(1);
    expect(f.store.getSnapshot().imported).toBe(false);
  });

  it('keeps applied write failures and reports the disk warning', async () => {
    const f = fixture();
    f.session.editTitle('Applied title');
    const write = f.api.content.edit;
    vi.spyOn(f.api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      if (!result.ok) return result;
      return {
        ok: false,
        error: {
          reason: 'write-failed',
          message: 'Disk',
          applied: result.value,
          unchangedFiles: ['song.llsong'],
        },
      };
    });
    expect(await f.store.saveImported({kind: 'new'})).toBe(true);
    expect(f.store.getSnapshot().imported).toBe(false);
    expect(f.problem).toHaveBeenCalledOnce();
  });

  it('blocks edits and duplicate operations while saving, and releases subscriptions', async () => {
    const f = fixture();
    f.session.editTitle('Captured title');
    const write = f.api.content.edit;
    let release = async (): Promise<void> => undefined;
    vi.spyOn(f.api.content, 'edit').mockImplementationOnce(
      edit =>
        new Promise(resolve => {
          release = async () => {
            resolve(await write(edit));
          };
        }),
    );
    const pending = f.store.saveImported({kind: 'new'});
    f.session.editTitle('Must not replace capture');
    f.store.discardImported();
    expect(await f.store.saveImported({kind: 'new'})).toBe(false);
    expect(f.session.title.value).toBe('Captured title');
    await release();
    expect(await pending).toBe(true);
    expect(await f.store.flush()).toBe(true);
    await f.store.dispose();
    expect(f.listenerCount()).toBe(0);
  });
});
