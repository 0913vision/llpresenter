import {act, fireEvent, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {thumbnailUrl} from '@contracts/ipc/media';
import {mediaDocument, mediaFixture, mediaId, mediaItem} from './mediaTesting';
import {cssRules} from '@renderer/shell/testing/cssRules';
import {DEFAULT_MEDIA_COLUMNS, MediaView} from './MediaView';
import {MediaViewProvider, useMediaView} from './MediaViewProvider';
import type {MediaListChoice} from './mediaEntries';
import type {MediaDocument, MediaImportResult} from '@core/schema/mediaEdit';
import {MEDIA_LIMITS} from '@core/schema/mediaList';
import {playlistId, audioPlaylistId} from './mediaTesting';
import {INITIAL_ROWS, OVERSCAN_ROWS} from './VirtualMediaGrid';
import {useShowKeys} from '@renderer/show/shortcuts';

function ShowKeys() {
  useShowKeys();
  return null;
}

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
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  render(
    <MediaViewProvider api={fixture.api} onProblem={problems}>
      {workspace === 'show' ? <ShowKeys /> : null}
      {choice !== undefined && <ChoiceButton choice={choice} />}
      <MediaView workspace={workspace} onProblem={problems} />
    </MediaViewProvider>,
  );
  return {...fixture, problems};
}

async function tile(name: string): Promise<HTMLElement> {
  const grid = screen.getByRole('listbox', {name: '모든 미디어'});
  return within(grid).findByRole('option', {name});
}

describe('media view', () => {
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
    fireEvent.contextMenu(
      await within(grid).findByRole('option', {name: 'Invented audio'}),
    );
    const menu = screen.getByRole('menu', {name: '미디어 메뉴'});
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
        item =>
          item.getAttribute('role') === 'separator' ? '|' : item.textContent,
      ),
    ).toEqual([
      '탐색기에서 보기',
      '재생 방식',
      '효과음으로 지정',
      '|',
      '속성…',
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

  it('caps dropped files before reading native paths', async () => {
    const {importFiles, pathForFile} = setup();
    const grid = await screen.findByRole('listbox', {name: '모든 미디어'});
    await tile('Dawn');
    pathForFile.mockImplementation(file => `C:\\media\\${file.name}`);
    const files = Array.from(
      {length: MEDIA_LIMITS.importBatch + 1},
      (_, index) => new File(['Invented bytes'], `${index}.mp4`),
    );
    fireEvent.drop(grid, {dataTransfer: {types: ['Files'], files}});
    expect(pathForFile).toHaveBeenCalledTimes(MEDIA_LIMITS.importBatch);
    expect(importFiles).toHaveBeenCalledWith({
      source: {
        kind: 'files',
        paths: files
          .slice(0, MEDIA_LIMITS.importBatch)
          .map(file => `C:\\media\\${file.name}`),
      },
      playlist: null,
    });
  });

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
      const button = screen.getByRole('button', {name: '가져오기'});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect((await hoverForTooltip(button))?.textContent).toBe(
        state === 'loading' ? '미디어를 불러오는 중' : '읽기 전용 미디어',
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
    fireEvent.doubleClick(video);
    expect(send).toHaveBeenCalledWith({
      type: 'media.show',
      media: {mediaId: mediaId(1), loop: true},
    });
    fireEvent.doubleClick(await tile('Hymn'));
    expect(send).toHaveBeenCalledOnce();
  });

  it('keeps 진행 click focus and outputs on activation while arrows only select', async () => {
    const {send} = setup(undefined, undefined, 'show');
    const prior = document.createElement('input');
    document.body.append(prior);
    onTestFinished(() => prior.remove());
    prior.focus();
    const video = await tile('Dawn');
    await userEvent.click(video);
    expect(document.activeElement).toBe(prior);
    expect(video.getAttribute('aria-selected')).toBe('true');
    expect(send).toHaveBeenCalledExactlyOnceWith({
      type: 'media.show',
      media: {mediaId: mediaId(1), loop: true},
    });
    fireEvent.keyDown(video, {key: 'ArrowRight'});
    expect(send).toHaveBeenCalledOnce();
    const selected = await tile('Notice');
    expect(selected.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(selected, {key: 'Enter'});
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('relinks a missing file from a click or its menu', async () => {
    const {edit, pushMissing, send} = setup();
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
    fireEvent.click(await screen.findByRole('menuitem', {name: '다시 연결…'}));
    expect(edit.mock.calls).toEqual([
      [{type: 'media.relink', mediaId: mediaId(1)}],
      [{type: 'media.relink', mediaId: mediaId(1)}],
    ]);
    expect(send).not.toHaveBeenCalled();
  });

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

  it('fills its column and scrolls only the grid, so the footer stays', () => {
    const rule = cssRules('src/renderer/src/prep/media/MediaView.module.css');
    expect(rule('.panel')).toContain('height: 100%');
    expect(rule('.body')).toContain('overflow: hidden');
    expect(rule('.viewport')).toContain('min-height: 0');
    expect(rule('.viewport')).toContain('overflow: auto');
  });

  it('deletes media from 모든 미디어 after asking', async () => {
    const {edit} = setup();
    fireEvent.contextMenu(await tile('Dawn'));
    expect(
      screen
        .getAllByRole('menuitem')
        .filter(item => item.getAttribute('aria-disabled') !== 'true')
        .map(item => item.textContent),
    ).toEqual(['삭제']);
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

  it('offers no changes for a list a newer version wrote', async () => {
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
        .every(item => item.getAttribute('aria-disabled') === 'true'),
    ).toBe(true);
  });
});
