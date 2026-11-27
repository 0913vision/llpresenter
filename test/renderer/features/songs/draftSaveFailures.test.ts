import {act, waitFor} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {EditResult} from '@core/schema/services/contentEdit';
import {DUPLICATE_TITLE_REASON} from '@core/songs';
import {
  closeSongDraft,
  editSong,
  openSongDraft,
  overwriteSong,
  startSongDraftSync,
  useSongDraft,
} from '@renderer/features/songs/draft';
import {isUnsaved} from '@renderer/features/songs/songDraftModel';
import {useThemes} from '@renderer/platform/documents/themes';
import type {Notice} from '@renderer/ui/popups/notices';
import {themes, themeScreens} from '@fixtures/core/themeOutput';
import {
  editorFixture,
  editorSong,
} from '@fixtures/renderer/features/songs/editorFixture';

let stop = (): void => undefined;
const notices: Notice[] = [];

/** An open song with one edit, whose save main answers with `answer`. */
async function editedSong(answer: () => Promise<EditResult>) {
  const fixture = editorFixture();
  const write = vi.fn();
  window.llp = {
    ...fixture.api,
    content: {...fixture.api.content, edit: answer},
    log: {...fixture.api.log, write},
  };
  stop = startSongDraftSync(window.llp, notice => notices.push(notice));
  await waitFor(() =>
    expect(useSongDraft.getState().libraryStatus).toBe('ready'),
  );
  act(() => openSongDraft(editorSong(1)));
  act(() => editSong(song => ({...song, slides: song.slides.slice(0, 1)})));
  return {write};
}

function draft() {
  const {draft: open} = useSongDraft.getState();
  if (open === null) throw new Error('No song is open');
  return open;
}

beforeEach(() => {
  notices.length = 0;
  useThemes.setState({themes: themes(), screens: themeScreens});
});
afterEach(() => {
  act(closeSongDraft);
  stop();
  delete window.llp;
});

it('says why a save was refused and keeps the edit unsaved', async () => {
  await editedSong(() =>
    Promise.resolve({ok: false, error: {reason: 'stale', message: 'newer'}}),
  );
  await expect(overwriteSong()).resolves.toBe(false);
  expect(notices.map(notice => [notice.title, notice.meta])).toEqual([
    [
      '곡 저장 실패',
      ['다른 곳에서 먼저 변경되었습니다.', '다시 시도하십시오.'],
    ],
  ]);
  expect(isUnsaved(draft())).toBe(true);
});

it('says the title is taken when another song has it', async () => {
  await editedSong(() =>
    Promise.resolve({
      ok: false,
      error: {reason: 'duplicate-title', message: 'taken'},
    }),
  );
  await expect(overwriteSong()).resolves.toBe(false);
  expect(notices.map(notice => notice.title)).toEqual([DUPLICATE_TITLE_REASON]);
});

it('says the file was not written although the song was kept, with what to check', async () => {
  const song = editorSong(1).song;
  await editedSong(() =>
    Promise.resolve({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'disk full',
        applied: {id: song.id, revision: 2},
        unchangedFiles: ['songs/song.llsong'],
      },
    }),
  );
  await overwriteSong();
  expect(notices[0]).toMatchObject({
    title: '곡 파일 저장 실패',
    meta: [
      '변경 내용을 파일에 저장할 수 없습니다.',
      '디스크 공간과 폴더 권한을 확인하십시오.',
    ],
  });
});

it('says 곡 저장 실패 alone for a request that failed, and logs its cause', async () => {
  const {write} = await editedSong(() =>
    Promise.reject(new Error('Invented failure')),
  );
  await expect(overwriteSong()).resolves.toBe(false);
  expect(notices.map(notice => [notice.title, notice.meta ?? []])).toEqual([
    ['곡 저장 실패', []],
  ]);
  expect(JSON.stringify(write.mock.calls)).toContain('Invented failure');
  expect(isUnsaved(draft())).toBe(true);
});
