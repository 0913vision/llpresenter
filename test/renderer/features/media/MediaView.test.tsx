import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {WorkspaceNavigation} from '@renderer/platform/WorkspaceNavigation';
import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
} from '@fixtures/renderer/features/media/mediaTesting';
import {
  DEFAULT_MEDIA_COLUMNS,
  MediaView,
} from '@renderer/features/media/MediaView';
import {
  MediaViewProvider,
  useMediaView,
} from '@renderer/features/media/MediaViewProvider';
import type {MediaListChoice} from '@renderer/features/media/mediaEntries';
import type {MediaDocument, MediaImportResult} from '@core/schema/mediaEdit';
import {
  playlistId,
  audioPlaylistId,
} from '@fixtures/renderer/features/media/mediaTesting';
import {
  INITIAL_ROWS,
  OVERSCAN_ROWS,
} from '@renderer/features/media/VirtualMediaGrid';

function ChoiceButton({choice}: {readonly choice: MediaListChoice}) {
  const {choose} = useMediaView();
  return <button onClick={() => choose(choice)}>Choose list</button>;
}

function setup(
  fixture = mediaFixture(
    mediaDocument([
      mediaItem(1, {name: 'Dawn', size: 1024}),
      mediaItem(2, {
        name: 'Notice',
        kind: 'image',
        file: 'notice.png',
        size: 1024,
      }),
      mediaItem(3, {name: 'Hymn', kind: 'audio', file: 'hymn.mp3', size: 1024}),
    ]),
  ),
  choice?: MediaListChoice,
  workspace: 'show' | 'prep' = 'prep',
) {
  const problems = vi.fn();
  const navigate = vi.fn();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  render(
    <WorkspaceNavigation value={navigate}>
      <MediaViewProvider api={fixture.api} onProblem={problems}>
        {choice !== undefined && <ChoiceButton choice={choice} />}
        <MediaView workspace={workspace} onProblem={problems} />
      </MediaViewProvider>
    </WorkspaceNavigation>,
  );
  return {...fixture, problems, navigate};
}

async function tile(name: string): Promise<HTMLElement> {
  const grid = screen.getByRole('listbox', {name: '모든 미디어'});
  return within(grid).findByRole('option', {name});
}

describe('media view', () => {
  it.each(['cancel', 'failed', 'complete'] as const)(
    'leaves the current workspace until a panel import completes: %s',
    async outcome => {
      const f = setup(undefined, undefined, 'show');
      await tile('Dawn');
      f.importFiles.mockResolvedValue({
        ok: true,
        value:
          outcome === 'cancel'
            ? []
            : [
                {
                  mediaId: mediaId(4),
                  fileName: 'New.mp4',
                  phase: 'queued',
                  percent: 0,
                },
              ],
      });
      await userEvent.click(screen.getByRole('button', {name: '가져오기'}));
      expect(f.navigate).not.toHaveBeenCalled();
      if (outcome !== 'cancel') {
        act(() => {
          if (outcome === 'complete') {
            f.pushDocument(mediaDocument([mediaItem(4)], 2));
          }
          f.pushProgress(
            outcome === 'complete'
              ? {
                  mediaId: mediaId(4),
                  fileName: 'New.mp4',
                  phase: 'complete',
                  percent: 100,
                }
              : {
                  mediaId: mediaId(4),
                  fileName: 'New.mp4',
                  phase: 'failed',
                  percent: 0,
                  message: 'Invented failure',
                },
          );
        });
      }
      expect(f.navigate).toHaveBeenCalledTimes(outcome === 'complete' ? 1 : 0);
    },
  );
  it('uses the audio item menu inside an audio playlist', async () => {
    const fixture = mediaFixture(
      mediaDocument(
        [
          mediaItem(1, {
            name: 'Invented audio',
            kind: 'audio',
            file: 'invented.mp3',
          }),
        ],
        1,
        {
          audioPlaylists: [
            {
              id: audioPlaylistId(1),
              name: 'Hymns',
              items: [mediaId(1)],
              loop: false,
            },
          ],
        },
      ),
    );
    setup(fixture, {kind: 'audio', id: audioPlaylistId(1)});
    fireEvent.click(screen.getByRole('button', {name: 'Choose list'}));
    const grid = await screen.findByRole('listbox', {name: 'Hymns'});
    const contextTarget = await within(grid).findByRole('option', {
      name: 'Invented audio',
    });
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    const menu = screen.getByRole('menu', {name: '미디어 메뉴'});
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
        item =>
          item.getAttribute('role') === 'separator' ? '|' : item.textContent,
      ),
    ).toEqual([
      '탐색기에서 보기',
      '재생',
      '효과음으로 지정',
      '|',
      '속성…',
      '복제',
      '이름 바꾸기',
      '|',
      '삭제',
    ]);
    fireEvent.click(within(menu).getByRole('menuitem', {name: '삭제'}));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '삭제',
      }),
    );
    await vi.waitFor(() =>
      expect(fixture.edit).toHaveBeenCalledWith({
        type: 'media.delete',
        mediaId: mediaId(1),
      }),
    );
  });

  afterEach(resetTooltips);
  it.each(['media', 'audio'] as const)(
    'drops native files into the selected %s playlist and shows copy progress',
    async kind => {
      const id = kind === 'media' ? playlistId(1) : audioPlaylistId(1);
      const document = mediaDocument([], 1, {
        playlists: [{id: playlistId(1), name: 'Target', items: []}],
        audioPlaylists: [
          {id: audioPlaylistId(1), name: 'Target', items: [], loop: true},
        ],
      });
      const {importFiles, pathForFile} = setup(mediaFixture(document), {
        kind,
        id,
      });
      fireEvent.click(screen.getByRole('button', {name: 'Choose list'}));
      const grid = await screen.findByRole('listbox', {name: 'Target'});
      const file = new File(['Invented bytes'], 'dropped.mp3');
      pathForFile.mockReturnValue('C:\\media\\dropped.mp3');
      importFiles.mockResolvedValue({
        ok: true,
        value: [
          {
            mediaId: mediaId(9),
            fileName: file.name,
            phase: 'queued',
            percent: 0,
          },
        ],
      });
      const dataTransfer = {
        types: ['Files'],
        files: [file],
        dropEffect: 'none',
      };
      expect(fireEvent.dragOver(grid, {dataTransfer})).toBe(false);
      expect(dataTransfer.dropEffect).toBe('copy');
      expect(fireEvent.drop(grid, {dataTransfer})).toBe(false);
      expect(importFiles).toHaveBeenCalledExactlyOnceWith({
        source: {kind: 'files', paths: ['C:\\media\\dropped.mp3']},
        playlist: {kind, id},
      });
      const copying = await within(grid).findByRole('option', {
        name: file.name,
      });
      expect(within(copying).getByRole('progressbar')).toBeDefined();
    },
  );

  it.each(['loading', 'readOnly'] as const)(
    'blocks file navigation and import while %s',
    async state => {
      const fixture = mediaFixture({...mediaDocument([]), access: 'readOnly'});
      if (state === 'loading') {
        vi.spyOn(fixture.api.media, 'get').mockReturnValue(
          new Promise<MediaDocument>(() => undefined),
        );
      }
      const {importFiles, pathForFile} = setup(fixture);
      const grid = screen.getByRole('listbox', {name: '모든 미디어'});
      await act(() => Promise.resolve());
      const buttons = screen.getAllByRole('button', {name: '가져오기'});
      for (const each of buttons) {
        expect(each.getAttribute('aria-disabled')).toBe('true');
      }
      const [button] = buttons;
      if (button === undefined) throw new Error('Missing 가져오기 button');
      expect((await hoverForTooltip(button))?.textContent).toBe(
        state === 'loading'
          ? '미디어를 불러오는 중'
          : '새 버전의 파일이라 바꿀 수 없습니다',
      );
      const dataTransfer = {
        types: ['Files'],
        files: [new File(['Invented bytes'], 'clip.mp4')],
        dropEffect: 'copy',
      };
      expect(fireEvent.dragOver(grid, {dataTransfer})).toBe(false);
      expect(dataTransfer.dropEffect).toBe('none');
      expect(fireEvent.drop(grid, {dataTransfer})).toBe(false);
      expect(pathForFile).not.toHaveBeenCalled();
      expect(importFiles).not.toHaveBeenCalled();
    },
  );

  it('does not accept text drags or empty file drops', async () => {
    const {importFiles, pathForFile} = setup();
    const grid = await screen.findByRole('listbox', {name: '모든 미디어'});
    await tile('Dawn');
    const dataTransfer = {types: ['text/plain'], files: []};
    expect(fireEvent.dragOver(grid, {dataTransfer})).toBe(true);
    expect(fireEvent.drop(grid, {dataTransfer})).toBe(true);
    fireEvent.drop(grid, {dataTransfer: {types: ['Files'], files: []}});
    expect(pathForFile).not.toHaveBeenCalled();
    expect(importFiles).not.toHaveBeenCalled();
  });

  it('blocks overlapping drops and accepts the next batch after the request finishes', async () => {
    const {importFiles, pathForFile} = setup();
    await tile('Dawn');
    const grid = screen.getByRole('listbox', {name: '모든 미디어'});
    pathForFile.mockReturnValue('C:\\media\\clip.mp4');
    let finish: (result: MediaImportResult) => void = () => undefined;
    importFiles.mockReturnValueOnce(
      new Promise<MediaImportResult>(resolve => {
        finish = resolve;
      }),
    );
    onTestFinished(() => finish({ok: true, value: []}));
    const dataTransfer = {
      types: ['Files'],
      files: [new File(['Invented bytes'], 'clip.mp4')],
    };
    fireEvent.drop(grid, {dataTransfer});
    fireEvent.drop(grid, {dataTransfer});
    expect(importFiles).toHaveBeenCalledOnce();
    await act(async () => {
      finish({ok: true, value: []});
    });
    fireEvent.drop(grid, {dataTransfer});
    expect(importFiles).toHaveBeenCalledTimes(2);
  });
  it('shows every item with its thumbnail and duration, and the total size', async () => {
    setup();
    const video = await tile('Dawn');
    expect(video.querySelector('img')?.getAttribute('src')).toBe(
      thumbnailUrl(mediaId(1)),
    );
    expect(video.textContent).toContain('0:30');
    const image = await tile('Notice');
    expect(image.querySelector('img')?.getAttribute('src')).toBe(
      thumbnailUrl(mediaId(2)),
    );
    expect(image.textContent).not.toContain('0:30');
    expect((await tile('Hymn')).querySelector('img')).toBeNull();
    expect(screen.getByText('3개 3.0KB')).toBeDefined();
  });

  it('shows 미디어 없음 with 가져오기 for an empty list, and not once there are items', async () => {
    setup(mediaFixture(mediaDocument([])));
    await act(() => Promise.resolve());

    const status = screen.getByRole('status');
    expect(status.textContent).toContain('미디어 없음');
    expect(
      within(status).getByRole('button', {name: '가져오기'}),
    ).toBeDefined();
  });

  it.each(['pending', 'rejected'] as const)(
    'shows no empty state while the list read is %s',
    async state => {
      const fixture = mediaFixture(mediaDocument([]));
      vi.spyOn(fixture.api.media, 'get').mockImplementation(() =>
        state === 'pending'
          ? new Promise<MediaDocument>(() => undefined)
          : Promise.reject(new Error('read failed')),
      );
      setup(fixture);
      await act(() => Promise.resolve());

      expect(screen.queryByRole('status')).toBeNull();
    },
  );

  it('shows no empty state while the list has items', async () => {
    setup();
    await tile('Dawn');

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('imports through the dialog and shows each copy in progress', async () => {
    const {importFiles, pushProgress} = setup();
    await tile('Dawn');
    fireEvent.click(screen.getByRole('button', {name: '가져오기'}));
    expect(importFiles).toHaveBeenCalledWith({
      source: {kind: 'dialog'},
      playlist: null,
    });
    act(() => {
      pushProgress({
        mediaId: mediaId(9),
        fileName: 'Easter.mp4',
        phase: 'copying',
        percent: 62,
      });
    });
    const copying = await tile('Easter.mp4');
    expect(copying.getAttribute('aria-disabled')).toBe('true');
    expect(within(copying).getByRole('progressbar')).toBeDefined();
  });

  it('selects a tile on click and outputs it as the background on double click', async () => {
    const {send} = setup();
    const video = await tile('Dawn');
    fireEvent.click(video);
    expect(video.getAttribute('aria-selected')).toBe('true');
    expect(send).not.toHaveBeenCalled();
    fireEvent.doubleClick(video);
    expect(send).toHaveBeenCalledWith({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'slide'},
        {
          type: 'media.show',
          media: {
            mediaId: mediaId(1),
            loop: true,
            itemId: `media:${mediaId(1)}`,
            title: 'Dawn',
          },
        },
      ],
    });
    fireEvent.doubleClick(await tile('Hymn'));
    expect(send).toHaveBeenCalledOnce();
  });

  it('outputs in 진행 without changing selection on click or Enter', async () => {
    const {send} = setup(undefined, undefined, 'show');
    const selected = await tile('Notice');
    fireEvent.keyDown(await tile('Dawn'), {key: 'ArrowRight'});
    expect(selected.getAttribute('aria-selected')).toBe('true');
    const video = await tile('Dawn');
    await userEvent.click(video);
    expect(video.getAttribute('aria-selected')).toBe('false');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'slide'},
        {
          type: 'media.show',
          media: {
            mediaId: mediaId(1),
            loop: true,
            itemId: `media:${mediaId(1)}`,
            title: 'Dawn',
          },
        },
      ],
    });
    video.focus();
    fireEvent.keyDown(video, {key: 'Enter'});
    expect(document.activeElement).toBe(video);
    expect(video.getAttribute('aria-selected')).toBe('false');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenLastCalledWith({
      type: 'live.batch',
      commands: [
        {type: 'layer.clear', target: 'slide'},
        {
          type: 'media.show',
          media: {
            mediaId: mediaId(1),
            loop: true,
            itemId: `media:${mediaId(1)}`,
            title: 'Dawn',
          },
        },
      ],
    });
  });

  it.each(['show', 'prep'] as const)(
    'selects properties from the context menu without output in %s',
    async workspace => {
      const {send} = setup(undefined, undefined, workspace);
      const selected = await tile('Notice');
      const video = await tile('Dawn');
      fireEvent.keyDown(video, {key: 'ArrowRight'});
      fireEvent.contextMenu(video);
      expect(selected.getAttribute('aria-selected')).toBe('true');
      const properties = screen.getByRole('menuitem', {name: '속성…'});
      expect(properties.getAttribute('aria-disabled')).not.toBe('true');
      fireEvent.click(properties);
      expect(video.getAttribute('aria-selected')).toBe('true');
      expect(selected.getAttribute('aria-selected')).toBe('false');
      expect(send).not.toHaveBeenCalled();
    },
  );

  it.each(['show', 'prep'] as const)(
    'relinks a missing file from a click or its menu in %s',
    async workspace => {
      const {edit, pushMissing, send} = setup(undefined, undefined, workspace);
      await tile('Dawn');
      act(() => {
        pushMissing([mediaId(1)]);
      });
      const missing = await tile('Dawn');
      expect(missing.getAttribute('data-state')).toBe('warning');
      fireEvent.click(missing);
      fireEvent.click(missing);
      fireEvent.doubleClick(missing);
      await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
      fireEvent.contextMenu(missing);
      fireEvent.click(
        await screen.findByRole('menuitem', {name: '다시 연결…'}),
      );
      expect(edit.mock.calls).toEqual([
        [{type: 'media.relink', mediaId: mediaId(1)}],
        [{type: 'media.relink', mediaId: mediaId(1)}],
      ]);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it('stops a copy from its menu', async () => {
    const {edit, pushProgress} = setup();
    await tile('Dawn');
    act(() => {
      pushProgress({
        mediaId: mediaId(9),
        fileName: 'Easter.mp4',
        phase: 'queued',
        percent: 0,
      });
    });
    fireEvent.contextMenu(await tile('Easter.mp4'));
    fireEvent.click(await screen.findByRole('menuitem', {name: '복사 멈추기'}));
    expect(edit).toHaveBeenCalledWith({
      type: 'media.import.cancel',
      mediaId: mediaId(9),
    });
  });

  it('mounts only the rows near the view of a long list and reaches every tile by keyboard', async () => {
    const fixture = mediaFixture(
      mediaDocument(
        Array.from({length: 60}, (_, index) =>
          mediaItem(index + 1, {name: `Tile ${index + 1}`}),
        ),
      ),
    );
    window.llp = fixture.api;
    onTestFinished(() => {
      delete window.llp;
    });
    render(
      <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
        <MediaView onProblem={vi.fn()} />
      </MediaViewProvider>,
    );
    const grid = screen.getByRole('listbox', {name: '모든 미디어'});
    await within(grid).findByRole('option', {name: 'Tile 1'});
    const mounted = within(grid).getAllByRole('option');
    const windowSize =
      (INITIAL_ROWS + OVERSCAN_ROWS * 2) * DEFAULT_MEDIA_COLUMNS;
    expect(mounted).toHaveLength(windowSize);
    expect(mounted[0]?.getAttribute('aria-setsize')).toBe('60');
    const last = mounted.at(-1);
    if (last === undefined) throw new Error('No mounted tile');
    fireEvent.click(last);
    fireEvent.keyDown(last, {key: 'ArrowDown'});
    const below = await within(grid).findByRole('option', {
      name: `Tile ${windowSize + DEFAULT_MEDIA_COLUMNS}`,
    });
    expect(below.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(below);
    fireEvent.keyDown(below, {key: 'End'});
    const end = await within(grid).findByRole('option', {name: 'Tile 60'});
    expect(end.getAttribute('aria-selected')).toBe('true');
    expect(end.getAttribute('aria-posinset')).toBe('60');
    expect(within(grid).getAllByRole('option').length).toBeLessThanOrEqual(
      windowSize,
    );
  });

  it('copies a media tile from its menu', async () => {
    const {edit} = setup();
    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '복제'}));
    await vi.waitFor(() =>
      expect(edit).toHaveBeenCalledExactlyOnceWith({
        type: 'media.duplicate',
        mediaId: mediaId(1),
      }),
    );
  });

  it('deletes media from 모든 미디어 after asking', async () => {
    const {edit} = setup();
    const mediaTarget = await tile('Dawn');
    fireEvent.contextMenu(mediaTarget);
    expect(mediaTarget.hasAttribute('data-menu-target')).toBe(true);
    expect(
      screen
        .getAllByRole('menuitem')
        .filter(item => item.getAttribute('aria-disabled') !== 'true')
        .map(item => item.textContent),
    ).toEqual([
      '속성…',
      '맞춤',
      '끝나면',
      '복제',
      '이름 바꾸기',
      '삭제',
      '탐색기에서 보기',
    ]);
    fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Dawn');
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
    await vi.waitFor(() =>
      expect(screen.queryByRole('alertdialog')).toBeNull(),
    );
    expect(edit).toHaveBeenCalledExactlyOnceWith({
      type: 'media.delete',
      mediaId: mediaId(1),
    });
  });

  it('names every place that uses the media in the delete question', async () => {
    const fixture = mediaFixture(
      mediaDocument([mediaItem(1, {name: 'Dawn', size: 1024})]),
    );
    vi.spyOn(fixture.api.media, 'uses').mockResolvedValue({
      playlists: 2,
      graphics: 1,
      songBackgrounds: 3,
      serviceItems: 4,
      itemOverlays: 0,
      themes: 1,
      macros: 2,
    });
    setup(fixture);
    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    const dialog = await screen.findByRole('alertdialog');
    const group = within(dialog).getByRole('group', {name: '쓰는 곳'});
    expect(
      [...group.querySelectorAll('p')].slice(1).map(row => row.textContent),
    ).toEqual([
      '재생목록2곳',
      '그래픽1곳',
      '곡 배경3곳',
      '예배 순서 항목4곳',
      '테마1곳',
      '매크로2곳',
    ]);
    expect(dialog.textContent).toContain('파일은 지워지지 않습니다');
  });

  it('shows no use line for unused media, and says when the uses cannot be checked', async () => {
    const fixture = mediaFixture(
      mediaDocument([mediaItem(1, {name: 'Dawn', size: 1024})]),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const uses = vi.spyOn(fixture.api.media, 'uses');
    setup(fixture);
    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    let dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).not.toContain('쓰는 곳');
    fireEvent.click(within(dialog).getByRole('button', {name: '취소'}));

    uses.mockRejectedValue(new Error('Unreachable'));
    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '삭제'}));
    dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('쓰는 곳 확인 실패');
    expect(fixture.edit).not.toHaveBeenCalled();
  });

  it('renames a media tile in a dialog and reveals its file', async () => {
    const reveal = vi.fn();
    const fixture = mediaFixture(
      mediaDocument([mediaItem(1, {name: 'Dawn', size: 1024})]),
    );
    fixture.api.media.reveal = reveal;
    const {edit} = setup(fixture);
    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '탐색기에서 보기'}));
    expect(reveal).toHaveBeenCalledExactlyOnceWith(mediaId(1));

    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const dialog = await screen.findByRole('dialog', {
      name: '미디어 이름 바꾸기',
    });
    const field = within(dialog).getByRole('textbox', {name: '미디어 이름'});
    fireEvent.change(field, {target: {value: ''}});
    expect(
      within(dialog)
        .getByRole('button', {name: '저장'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.change(field, {target: {value: '  새벽  '}});
    fireEvent.click(within(dialog).getByRole('button', {name: '저장'}));
    await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
    const [sent] = edit.mock.calls[0] ?? [];
    expect(sent).toMatchObject({
      type: 'media.properties.update',
      mediaId: mediaId(1),
      changes: {name: '새벽'},
    });
  });

  it('stops a media name longer than the name limit in the rename dialog', async () => {
    const {edit} = setup(
      mediaFixture(mediaDocument([mediaItem(1, {name: 'Dawn'})])),
    );
    fireEvent.contextMenu(await tile('Dawn'));
    fireEvent.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    const dialog = await screen.findByRole('dialog', {
      name: '미디어 이름 바꾸기',
    });
    const field = within(dialog).getByRole('textbox', {name: '미디어 이름'});
    fireEvent.change(field, {
      target: {value: 'ㄱ'.repeat(MEDIA_LIMITS.name + 1)},
    });
    expect(
      within(dialog)
        .getByRole('button', {name: '저장'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(edit).not.toHaveBeenCalled();
  });

  it('offers only properties and the file location for a list a newer version wrote', async () => {
    const fixture = mediaFixture({
      ...mediaDocument([mediaItem(1, {name: 'Dawn'})]),
      access: 'readOnly',
    });
    window.llp = fixture.api;
    onTestFinished(() => {
      delete window.llp;
    });
    render(
      <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
        <MediaView onProblem={vi.fn()} />
      </MediaViewProvider>,
    );
    fireEvent.contextMenu(await tile('Dawn'));
    expect(
      screen
        .getAllByRole('menuitem')
        .filter(item => item.getAttribute('aria-disabled') !== 'true')
        .map(item => item.textContent),
    ).toEqual(['속성…', '탐색기에서 보기']);
  });
});
