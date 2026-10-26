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
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import type {TextImportReadResult} from '@shared/schema/textImport';
import {convertTextImport} from '../../../../main/import/convert';
import {editorFixture} from '../editor/editorFixture';
import {SongEditorStore} from '../editor/songEditorStore';
import {ImportedSongActions} from './ImportedSongActions';
import {TextImportFlow} from './TextImportFlow';

function fixture() {
  const f = editorFixture();
  const problem = vi.fn();
  const store = new SongEditorStore(f.api, problem);
  onTestFinished(() => store.dispose());
  return {...f, store, problem};
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
