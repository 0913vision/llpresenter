import {useState} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {parseGroupedSong} from '@core/schema/groupedSong';
import {contentFixture} from '../../../../../../test/content-fixture';
import {convertTextImport} from '../../../../../main/import/convert';
import {editorFixture} from '../editor/editorFixture';
import {SongEditor} from '../editor/SongEditor';
import {SongEditorStore} from '../editor/songEditorStore';
import {TextImportFlow} from './TextImportFlow';

it('imports invented text, edits it, and saves a real song document without opening a window', async () => {
  const backend = contentFixture();
  const editor = editorFixture();
  let lastFailure: unknown;
  const api = fakeLlpApi({
    ...editor.api,
    songs: backend.songs,
    content: {
      edit: async edit => {
        const result = await backend.store.apply(edit);
        if (!result.ok) lastFailure = result.error;
        return result;
      },
    },
    textImport: {
      read: async () => ({
        ok: true,
        value: {
          source: 'file',
          fileName: 'New song.txt',
          text: '[1절]\nAn invented line',
        },
      }),
      preview: async request => convertTextImport(request),
    },
  });
  const problem = vi.fn();
  const store = new SongEditorStore(api, problem);
  onTestFinished(async () => {
    await store.dispose();
    await backend.dispose();
  });
  function Harness() {
    const [editing, setEditing] = useState(false);
    return editing ? (
      <SongEditor store={store} />
    ) : (
      <TextImportFlow
        api={api}
        store={store}
        source="file"
        onDone={() => undefined}
        onEdit={() => setEditing(true)}
        onProblem={problem}
      />
    );
  }
  render(<Harness />);
  await screen.findByText('슬라이드 1');
  fireEvent.click(screen.getByRole('button', {name: '편집'}));
  const title = await screen.findByRole('textbox', {name: '곡 제목'});
  fireEvent.change(title, {target: {value: 'An invented title'}});
  await waitFor(() =>
    expect(
      screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
    ).toBeNull(),
  );
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => {
    if (problem.mock.calls.length) {
      throw new Error(JSON.stringify(lastFailure ?? problem.mock.calls));
    }
    expect(backend.store.songList()).toHaveLength(1);
  });
  await waitFor(() => expect(store.getSnapshot().imported).toBe(false));
  await backend.store.flush();
  expect(backend.store.songList().map(song => song.title)).toEqual([
    'An invented title',
  ]);
  const text = [...backend.texts].find(([file]) =>
    file.endsWith('.llsong'),
  )?.[1];
  if (text === undefined) throw new Error('Song was not saved');
  const parsed = parseGroupedSong(text, 'song');
  expect(parsed.ok).toBe(true);
  if (parsed.ok) {
    expect(
      parsed.value.data.groups.flatMap(group =>
        group.slides.flatMap(slide => slide.lines),
      ),
    ).toContain('An invented line');
  }
  expect(problem).not.toHaveBeenCalled();
});
