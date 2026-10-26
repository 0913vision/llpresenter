import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {thumbnailUrl} from '@shared/media';
import {mediaDocument, mediaFixture, mediaId, mediaItem} from './mediaTesting';
import {cssRules} from '@renderer/shell/testing/cssRules';
import {DEFAULT_MEDIA_COLUMNS, MediaView} from './MediaView';
import {MediaViewProvider} from './MediaViewProvider';
import {INITIAL_ROWS, OVERSCAN_ROWS} from './VirtualMediaGrid';

function setup() {
  const fixture = mediaFixture(
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
  );
  const problems = vi.fn();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  render(
    <MediaViewProvider api={fixture.api} onProblem={problems}>
      <MediaView onProblem={problems} />
    </MediaViewProvider>,
  );
  return {...fixture, problems};
}

async function tile(name: string): Promise<HTMLElement> {
  const grid = screen.getByRole('listbox', {name: '모든 미디어'});
  return within(grid).findByRole('option', {name});
}

describe('media view', () => {
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
    fireEvent.click(await screen.findByRole('menuitem', {name: '다시 연결'}));
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
      screen.getAllByRole('menuitem').map(item => item.textContent),
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
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
