import {StrictMode} from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import type {Notice} from '@renderer/ui/notices';
import type {TextImportReadResult} from '@core/schema/textImport';
import type {SongDocument} from '@core/schema/contentDocuments';
import {SONG_IMPORT_LIMITS} from '@core/schema/songImport';
import {parseGroupedSongDraft} from '@core/schema/groupedSong';
import {convertTextImport} from '../../../../main/import/convert';
import {editorFixture, editorSong} from '../editor/editorFixture';
import {SongEditorStore} from '../editor/songEditorStore';
import {SongEditor} from '../editor/SongEditor';
import {ImportedSongActions} from './ImportedSongActions';
import {TextImportFlow} from './TextImportFlow';

function fixture(f = editorFixture()) {
  const problem = vi.fn<(notice: Notice) => void>();
  const store = new SongEditorStore(f.api, problem);
  onTestFinished(() => store.dispose());
  return {...f, store, problem};
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return {promise, resolve};
}

describe('text import flow', () => {
  it('reads once in StrictMode, previews and opens an unsaved editor', async () => {
    const f = fixture();
    const read = vi.fn(async (): Promise<TextImportReadResult> => ({
      ok: true,
      value: {source: 'file', fileName: 'Invented.txt', text: 'Invented line'},
    }));
    const api = fakeLlpApi({
      ...f.api,
      textImport: {read, preview: async request => convertTextImport(request)},
    });
    const onDone = vi.fn();
    const onEdit = vi.fn();
    await act(async () => {
      render(
        <StrictMode>
          <TextImportFlow
            api={api}
            store={f.store}
            source="file"
            onDone={onDone}
            onEdit={onEdit}
            onProblem={f.problem}
          />
        </StrictMode>,
      );
    });
    expect(screen.getByText('슬라이드 1')).toBeTruthy();
    expect(read).toHaveBeenCalledExactlyOnceWith({
      source: 'file',
      encoding: 'auto',
    });
    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.store.getSnapshot().imported).toBe(true);
    expect(f.store.getSnapshot().session?.title.value).toBe('Invented');
    expect(onDone).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
    expect(f.edits).toHaveLength(0);
  });

  it('previews candidate group boundaries and preserves section labels on open', async () => {
    const f = fixture();
    const text =
      '[1절]\nFirst verse line\nSecond verse line\n\nThird verse line\nFourth verse line\n\n[후렴]\nChorus first line\nChorus second line\n\nChorus third line\nChorus fourth line';
    const read = vi.fn(async (): Promise<TextImportReadResult> => ({
      ok: true,
      value: {source: 'file', fileName: 'Candidate.txt', text},
    }));
    const api = fakeLlpApi({
      ...f.api,
      textImport: {read, preview: async request => convertTextImport(request)},
    });
    const onDone = vi.fn();
    const onEdit = vi.fn();
    render(
      <TextImportFlow
        api={api}
        store={f.store}
        source="file"
        onDone={onDone}
        onEdit={onEdit}
        onProblem={f.problem}
      />,
    );
    await screen.findByText('슬라이드 4');
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    const opt0 = options[0];
    const opt1 = options[1];
    const opt2 = options[2];
    const opt3 = options[3];
    if (!opt0 || !opt1 || !opt2 || !opt3) {
      throw new Error('Missing preview option');
    }
    expect(within(opt0).getByText('1절')).toBeTruthy();
    expect(within(opt1).queryByText('1절')).toBeNull();
    expect(within(opt2).getByText('후렴')).toBeTruthy();
    expect(within(opt3).queryByText('후렴')).toBeNull();

    fireEvent.click(screen.getByRole('button', {name: '편집'}));
    expect(f.store.getSnapshot().imported).toBe(true);
    const session = f.store.getSnapshot().session;
    expect(session?.title.value).toBe('Candidate');
    expect(
      session?.history.snapshot.song.groups.map(group => ({
        name: group.name,
        count: group.slides.length,
      })),
    ).toEqual([
      {name: '1절', count: 2},
      {name: '후렴', count: 2},
    ]);
    expect(
      session?.history.snapshot.song.groups.flatMap(group => group.slides),
    ).toEqual([
      {lines: ['First verse line', 'Second verse line']},
      {lines: ['Third verse line', 'Fourth verse line']},
      {lines: ['Chorus first line', 'Chorus second line']},
      {lines: ['Chorus third line', 'Chorus fourth line']},
    ]);
    expect(onDone).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it.each(['cancel', 'failure'] as const)(
    'handles a read %s without opening an editor',
    async kind => {
      const f = fixture();
      const api = fakeLlpApi({
        ...f.api,
        textImport: {
          read: async () =>
            kind === 'cancel'
              ? {ok: true, value: null}
              : {
                  ok: false,
                  error: {reason: 'empty', message: 'Empty clipboard'},
                },
        },
      });
      const onDone = vi.fn();
      render(
        <TextImportFlow
          api={api}
          store={f.store}
          source="clipboard"
          onDone={onDone}
          onEdit={vi.fn()}
          onProblem={f.problem}
        />,
      );
      await waitFor(() => expect(onDone).toHaveBeenCalledOnce());
      expect(f.problem).toHaveBeenCalledTimes(kind === 'failure' ? 1 : 0);
      expect(f.store.getSnapshot().session).toBeNull();
    },
  );

  it('ignores a pending read after closing', async () => {
    const f = fixture();
    let resolve: (result: TextImportReadResult) => void = () => undefined;
    const api = fakeLlpApi({
      ...f.api,
      textImport: {
        read: () =>
          new Promise(finish => {
            resolve = finish;
          }),
      },
    });
    const onDone = vi.fn();
    const view = render(
      <TextImportFlow
        api={api}
        store={f.store}
        source="clipboard"
        onDone={onDone}
        onEdit={vi.fn()}
        onProblem={f.problem}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    view.unmount();
    await act(async () =>
      resolve({ok: false, error: {reason: 'empty', message: 'Empty'}}),
    );
    expect(onDone).not.toHaveBeenCalled();
    expect(f.problem).not.toHaveBeenCalled();
  });
});

describe('imported song actions', () => {
  it('waits for the catalog before either save entry point checks duplicates', async () => {
    const apiFixture = editorFixture();
    const entries = await apiFixture.api.songs.list();
    const pending = deferred<typeof entries>();
    vi.spyOn(apiFixture.api.songs, 'list').mockReturnValueOnce(pending.promise);
    const f = fixture(apiFixture);
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Draft']}],
    });
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<SongEditor store={f.store} />);
    const button = screen.getByRole('button', {name: '저장'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('textbox', {name: '곡 제목'}), {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
    });
    expect(save).not.toHaveBeenCalled();
    await act(async () => pending.resolve(entries));
    expect(button.getAttribute('aria-disabled')).toBeNull();
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.keyDown(screen.getByRole('textbox', {name: '곡 제목'}), {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain(
      `새 곡 제목: ‘${f.first.song.title} (2)’`,
    );
    expect(save).not.toHaveBeenCalled();
    expect(f.edits).toHaveLength(0);
  });

  it('retains the draft on a failed catalog read and re-enables save after retry', async () => {
    const apiFixture = editorFixture();
    const entries = await apiFixture.api.songs.list();
    const retryRead = deferred<typeof entries>();
    vi.spyOn(apiFixture.api.songs, 'list')
      .mockRejectedValueOnce(new Error('Catalog unavailable'))
      .mockReturnValueOnce(retryRead.promise);
    const f = fixture(apiFixture);
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Draft']}],
    });
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<SongEditor store={f.store} />);
    await waitFor(() => expect(f.problem).toHaveBeenCalledOnce());
    const button = screen.getByRole('button', {name: '저장'});
    expect(button.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole('textbox', {name: '곡 제목'}), {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
    });
    expect(save).not.toHaveBeenCalled();
    expect(f.store.getSnapshot().imported).toBe(true);
    expect(
      screen
        .getByRole('button', {name: '버리기'})
        .getAttribute('aria-disabled'),
    ).toBeNull();
    const retry = f.problem.mock.calls[0]?.[0].actions?.[0]?.onSelect;
    if (retry === undefined) throw new Error('Missing catalog retry');
    act(() => {
      retry();
    });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    await act(async () => retryRead.resolve(entries));
    fireEvent.click(button);
    await screen.findByRole('alertdialog');
    expect(save).not.toHaveBeenCalled();
    expect(f.edits).toHaveLength(0);
  });

  it('withholds confirmation actions and stale candidates while a retry is pending', async () => {
    const apiFixture = editorFixture();
    const entries = await apiFixture.api.songs.list();
    const retryRead = deferred<typeof entries>();
    vi.spyOn(apiFixture.api.songs, 'list')
      .mockRejectedValueOnce(new Error('Catalog unavailable'))
      .mockReturnValueOnce(retryRead.promise);
    const f = fixture(apiFixture);
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Draft']}],
    });
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<ImportedSongActions store={f.store} />);
    await waitFor(() => expect(f.problem).toHaveBeenCalledOnce());
    act(() => f.pushList(entries));
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    const dialog = await screen.findByRole('alertdialog');
    const retry = f.problem.mock.calls[0]?.[0].actions?.[0]?.onSelect;
    if (retry === undefined) throw new Error('Missing catalog retry');
    act(() => {
      retry();
    });
    expect(dialog.textContent).not.toContain('새 곡 제목:');
    for (const name of ['새 곡으로 저장', '덮어쓰기']) {
      const button = within(dialog).getByRole('button', {name});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(button);
    }
    expect(save).not.toHaveBeenCalled();
    await act(async () =>
      retryRead.resolve(
        entries.map(entry =>
          entry.id === f.second.song.id
            ? {...entry, title: `${f.first.song.title} (2)`}
            : entry,
        ),
      ),
    );
    expect(dialog.textContent).toContain(
      `새 곡 제목: ‘${f.first.song.title} (3)’`,
    );
    fireEvent.click(
      within(dialog).getByRole('button', {name: '새 곡으로 저장'}),
    );
    await waitFor(() =>
      expect(save).toHaveBeenCalledExactlyOnceWith({kind: 'new'}),
    );
    expect(f.store.getSnapshot().session?.title.value).toBe(
      `${f.first.song.title} (3)`,
    );
  });

  it('disables overwrite for a read-only target without preventing a new copy', async () => {
    const f = fixture();
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Imported line']}],
    });
    await Promise.resolve();
    vi.spyOn(f.api.songs, 'get').mockResolvedValueOnce({
      ...f.first,
      access: 'readOnly',
    });
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<ImportedSongActions store={f.store} />);
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await screen.findByRole('alertdialog');
    expect(
      screen
        .getByRole('button', {name: '덮어쓰기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.keyDown(screen.getByRole('alertdialog'), {key: 'Enter'});
    expect(save).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole('button', {name: '새 곡으로 저장'})
        .getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('reports a failed overwrite-target read and retains the editable draft', async () => {
    const f = fixture();
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Imported line']}],
    });
    await Promise.resolve();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(f.api.songs, 'get').mockRejectedValueOnce(
      new Error('Invented failure'),
    );
    render(<ImportedSongActions store={f.store} />);
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(f.problem).toHaveBeenCalledOnce());
    expect(f.store.getSnapshot().imported).toBe(true);
    expect(f.store.getSnapshot().session?.readOnly).toBe(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it.each(['new document', 'new catalog', 'replacement'] as const)(
    'does not confirm a stale overwrite target after a %s arrives during the read',
    async change => {
      const f = fixture();
      f.store.openImported({
        title: f.first.song.title,
        slides: [{lines: ['Invented imported line']}],
      });
      await waitFor(() =>
        expect(f.store.getSnapshot().libraryStatus).toBe('ready'),
      );
      const pending = deferred<SongDocument | null>();
      vi.spyOn(f.api.songs, 'get').mockReturnValueOnce(pending.promise);
      const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
      render(<ImportedSongActions store={f.store} />);
      fireEvent.click(screen.getByRole('button', {name: '저장'}));
      const renamed = {
        ...f.first,
        song: {...f.first.song, title: 'Renamed song'},
      };
      if (change === 'new catalog') act(() => f.pushSong(renamed));
      if (change === 'replacement') {
        act(() =>
          f.pushList(
            f.store
              .getSnapshot()
              .library.filter(entry => entry.id !== f.first.song.id)
              .map(entry => ({...entry, title: f.first.song.title})),
          ),
        );
      }
      await act(async () =>
        pending.resolve(change === 'new document' ? renamed : f.first),
      );
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(f.problem).toHaveBeenCalledWith(
        expect.objectContaining({title: '중복 곡이 변경되었습니다'}),
      );
      expect(save).not.toHaveBeenCalled();
      expect(f.store.getSnapshot().imported).toBe(true);
      expect(f.edits).toHaveLength(0);
      if (change === 'new catalog') {
        fireEvent.click(screen.getByRole('button', {name: '저장'}));
        await waitFor(() =>
          expect(save).toHaveBeenCalledExactlyOnceWith({kind: 'new'}),
        );
      }
    },
  );

  async function actions(title = '') {
    const f = fixture();
    f.store.openImported({title, slides: [{lines: ['Invented line']}]});
    await Promise.resolve();
    const onSaved = vi.fn();
    render(<ImportedSongActions store={f.store} onSaved={onSaved} />);
    return {...f, onSaved};
  }

  it('disables saving an empty title and confirms leaving the draft', async () => {
    const f = await actions();
    expect(
      screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
    ).toBe('true');
    act(() => f.store.open(f.first));
    expect(screen.getByRole('alertdialog').textContent).toContain(
      '가져온 곡을 저장하지 않았습니다. 버릴까요?',
    );
    fireEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(f.store.getSnapshot().imported).toBe(true);
    act(() => f.store.open(f.first));
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '버리기',
      }),
    );
    expect(f.store.getSnapshot().imported).toBe(false);
    expect(f.store.getSnapshot().session?.document.song.id).toBe(
      f.first.song.id,
    );
  });

  it.each(['곡 제목', '슬라이드 1 가사'])(
    'saves the imported draft from %s with Ctrl S',
    async name => {
      const f = fixture();
      f.store.openImported({
        title: 'Imported keyboard title',
        slides: [{lines: ['Invented keyboard line']}],
      });
      const accepted = editorSong(3);
      vi.spyOn(f.api.content, 'edit').mockImplementation(async edit => {
        if (edit.type !== 'song.import') {
          throw new Error('Unexpected keyboard edit');
        }
        const migrated = parseGroupedSongDraft(
          JSON.stringify({
            format: 'llsong',
            schemaVersion: 1,
            id: accepted.song.id,
            ...edit.draft,
          }),
          'imported song',
        );
        if (!migrated.ok) {
          throw new Error(migrated.error.message);
        }
        f.pushSong({...accepted, song: migrated.value.data});
        return {
          ok: true,
          value: {id: accepted.song.id, revision: accepted.revision},
        };
      });
      const save = vi.spyOn(f.store, 'saveImported');
      const onSaved = vi.fn();
      render(<SongEditor store={f.store} onImportedSave={onSaved} />);
      await waitFor(() =>
        expect(
          screen
            .getByRole('button', {name: '저장'})
            .getAttribute('aria-disabled'),
        ).toBeNull(),
      );
      const field = screen.getByRole('textbox', {name});
      act(() => field.focus());
      expect(
        fireEvent.keyDown(field, {key: 's', code: 'KeyS', ctrlKey: true}),
      ).toBe(false);
      await waitFor(() => expect(f.store.getSnapshot().imported).toBe(false));
      expect(save).toHaveBeenCalledExactlyOnceWith({kind: 'new'});
      expect(
        f.store
          .getSnapshot()
          .library.some(entry => entry.title === 'Imported keyboard title'),
      ).toBe(true);
      expect(onSaved).toHaveBeenCalledOnce();
      expect(screen.queryByRole('button', {name: '저장'})).toBeNull();
    },
  );

  it('uses duplicate confirmation from Ctrl S without saving through the open modal', async () => {
    const f = fixture();
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Invented duplicate line']}],
    });
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<SongEditor store={f.store} />);
    await waitFor(() => expect(f.store.getSnapshot().library).toHaveLength(2));
    fireEvent.keyDown(screen.getByRole('textbox', {name: '곡 제목'}), {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
    });
    const dialog = await screen.findByRole('alertdialog');
    expect(
      within(dialog).getByText(`새 곡 제목: ‘${f.first.song.title} (2)’`),
    ).toBeDefined();
    fireEvent.keyDown(dialog, {key: 's', code: 'KeyS', ctrlKey: true});
    expect(save).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBe(dialog);
  });

  it('saves a new title and requests library selection after acceptance', async () => {
    const f = await actions('Imported title');
    const save = vi
      .spyOn(f.store, 'saveImported')
      .mockImplementation(async () => {
        f.store.discardImported();
        f.store.open(f.first);
        return true;
      });
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() =>
      expect(f.onSaved).toHaveBeenCalledExactlyOnceWith(f.first.song.id),
    );
    expect(save).toHaveBeenCalledExactlyOnceWith({kind: 'new'});
  });

  it('omits an unavailable candidate and keeps saving as new disabled', async () => {
    const f = fixture();
    await waitFor(() => expect(f.store.getSnapshot().library).toHaveLength(2));
    const title = '가'.repeat(SONG_IMPORT_LIMITS.name);
    f.pushSong({...f.first, song: {...f.first.song, title}});
    f.store.openImported({title, slides: [{lines: ['Imported line']}]});
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<ImportedSongActions store={f.store} />);
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).not.toContain('새 곡 제목:');
    const choice = screen.getByRole('button', {name: '새 곡으로 저장'});
    expect(choice.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(choice);
    expect(save).not.toHaveBeenCalled();
  });

  it('updates the proposed title before saving when the library changes', async () => {
    const f = fixture();
    f.store.openImported({
      title: f.first.song.title,
      slides: [{lines: ['Imported line']}],
    });
    await Promise.resolve();
    const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
    render(<ImportedSongActions store={f.store} />);
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await screen.findByText(`새 곡 제목: ‘${f.first.song.title} (2)’`);
    act(() =>
      f.pushList(
        f.store
          .getSnapshot()
          .library.map(entry =>
            entry.id === f.second.song.id
              ? {...entry, title: `${f.first.song.title} (2)`}
              : entry,
          ),
      ),
    );
    expect(
      screen.getByText(`새 곡 제목: ‘${f.first.song.title} (3)’`),
    ).toBeDefined();
    expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '새 곡으로 저장'}));
    await waitFor(() =>
      expect(save).toHaveBeenCalledExactlyOnceWith({kind: 'new'}),
    );
    expect(f.store.getSnapshot().session?.title.value).toBe(
      `${f.first.song.title} (3)`,
    );
  });

  it.each(['overwrite', 'new', 'cancel'] as const)(
    'resolves an existing title with %s',
    async choice => {
      const f = fixture();
      f.store.openImported({
        title: f.first.song.title,
        slides: [{lines: ['Imported line']}],
      });
      await Promise.resolve();
      const save = vi.spyOn(f.store, 'saveImported').mockResolvedValue(false);
      render(<ImportedSongActions store={f.store} />);
      fireEvent.click(screen.getByRole('button', {name: '저장'}));
      await screen.findByRole('alertdialog');
      expect(screen.getByText('슬라이드 2개')).toBeDefined();
      expect(
        screen.getByText(`새 곡 제목: ‘${f.first.song.title} (2)’`),
      ).toBeDefined();
      expect(save).not.toHaveBeenCalled();
      if (choice === 'cancel') {
        fireEvent.keyDown(screen.getByRole('alertdialog'), {key: 'Escape'});
        expect(save).not.toHaveBeenCalled();
      } else if (choice === 'new') {
        fireEvent.click(screen.getByRole('button', {name: '새 곡으로 저장'}));
        await waitFor(() =>
          expect(save).toHaveBeenCalledExactlyOnceWith({kind: 'new'}),
        );
        expect(f.store.getSnapshot().session?.title.value).toBe(
          `${f.first.song.title} (2)`,
        );
      } else {
        fireEvent.keyDown(screen.getByRole('alertdialog'), {key: 'Enter'});
        await waitFor(() =>
          expect(save).toHaveBeenCalledExactlyOnceWith({
            kind: 'overwrite',
            songId: f.first.song.id,
            baseRevision: f.first.revision,
          }),
        );
      }
    },
  );
});
