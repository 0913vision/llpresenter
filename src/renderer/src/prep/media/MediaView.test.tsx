import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {thumbnailUrl} from '@shared/media';
import {mediaDocument, mediaFixture, mediaId, mediaItem} from './mediaTesting';
import {MediaView} from './MediaView';

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
  render(<MediaView api={fixture.api} onProblem={problems} />);
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

  it('stops a copy from its menu, and opens no menu for a plain tile', async () => {
    const {edit, pushProgress} = setup();
    fireEvent.contextMenu(await tile('Dawn'));
    expect(screen.queryByRole('menu')).toBeNull();
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
});
