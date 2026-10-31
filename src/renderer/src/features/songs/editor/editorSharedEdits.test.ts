import {describe, expect, it, vi} from 'vitest';
import {setup} from './songEditorStoreFixture';

describe('shared label edits', () => {
  it('renames labels through main across songs and undo history', async () => {
    const {store, session, second, text, labelEdits, documents} = setup();
    await Promise.resolve();
    text('draft');
    await session.flush();
    store.open(second);
    expect(await store.renameLabel('1절', '새 절')).toBe(true);
    expect(labelEdits[0]).toMatchObject({
      type: 'labels.rename',
      name: 'labels',
      from: '1절',
      to: '새 절',
      baseRevision: 1,
    });
    for (const document of documents.values()) {
      expect(document.song.groups[0]?.name).toBe('새 절');
    }
    session.edit('undo');
    await session.flush();
    expect(session.history.snapshot.song.groups[0]?.name).toBe('새 절');
  });

  it('flushes queued text before a rename and maps the redo history', async () => {
    const {api, store, session, text, labelEdits, first} = setup();
    await Promise.resolve();
    const write = api.content.edit;
    let release: () => void = () => undefined;
    let waiting = false;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
        waiting = true;
      });
    });
    text('first');
    const earlier = session.flush();
    await vi.waitFor(() => expect(waiting).toBe(true));
    text('latest');
    const rename = store.renameLabel('1절', '새 절');
    expect(store.getSnapshot().busy).toBe(true);
    expect(labelEdits).toHaveLength(0);
    release();
    expect(await earlier).toBe(true);
    expect(await rename).toBe(true);
    expect(
      session.document.song.groups.flatMap(group => group.slides)[0],
    ).toMatchObject({
      lines: ['latest'],
    });
    session.edit('undo');
    await session.flush();
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0]
        ?.lines,
    ).toEqual(first.song.groups.flatMap(group => group.slides)[0]?.lines);
    session.edit('redo');
    await session.flush();
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0],
    ).toMatchObject({
      lines: ['latest'],
    });
  });

  it('does not rename while a song has an unresolved save refusal', async () => {
    const {api, store, text, session, labelEdits} = setup();
    await Promise.resolve();
    vi.spyOn(api.content, 'edit').mockRejectedValueOnce(
      new Error('Disconnected'),
    );
    text('retained');
    await session.flush();
    expect(await store.renameLabel('1절', '끝')).toBe(false);
    expect(labelEdits).toHaveLength(0);
    expect(store.getSnapshot().busy).toBe(false);
  });

  it('maps an existing redo snapshot when the global label is renamed', async () => {
    const {store, session, text} = setup();
    await Promise.resolve();
    text('redo draft');
    await session.flush();
    session.edit('undo');
    await session.flush();
    expect(await store.renameLabel('1절', '새 절')).toBe(true);
    session.edit('redo');
    await session.flush();
    expect(
      session.history.snapshot.song.groups.flatMap(group => group.slides)[0],
    ).toMatchObject({
      lines: ['redo draft'],
    });
  });
});
