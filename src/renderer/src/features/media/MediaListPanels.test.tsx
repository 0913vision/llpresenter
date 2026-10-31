import {act, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, describe, expect, it, onTestFinished, vi} from 'vitest';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {AudioListsPanel, MediaListsPanel} from './MediaListPanels';
import {MediaView} from './MediaView';
import {MediaViewProvider} from './MediaViewProvider';
import {
  audioPlaylistId,
  mediaDocument,
  mediaFixture,
  mediaId,
  mediaItem,
  playlistId,
} from './mediaTesting';

const LISTS = {
  playlists: [
    {id: playlistId(1), name: 'Backgrounds', items: [mediaId(2)]},
    {id: playlistId(2), name: '', items: []},
  ],
  audioPlaylists: [
    {id: audioPlaylistId(1), name: 'Hymns', items: [mediaId(3)], loop: true},
  ],
};

function setup(
  document = mediaDocument(
    [
      mediaItem(1, {name: 'Dawn'}),
      mediaItem(2, {name: 'Waves'}),
      mediaItem(3, {name: 'Hymn', kind: 'audio', file: 'hymn.mp3'}),
    ],
    1,
    LISTS,
  ),
  fixture = mediaFixture(document),
) {
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  render(
    <MediaViewProvider api={fixture.api} onProblem={vi.fn()}>
      <MediaListsPanel />
      <AudioListsPanel />
      <MediaView onProblem={vi.fn()} />
    </MediaViewProvider>,
  );
  return fixture;
}

async function row(list: string, name: RegExp | string): Promise<HTMLElement> {
  return within(screen.getByRole('listbox', {name: list})).findByRole(
    'option',
    {name},
  );
}

describe('media list panels', () => {
  it.each([
    {list: '미디어 목록', name: 'Backgrounds', key: 'ContextMenu'},
    {list: '미디어 목록', name: 'Backgrounds', key: 'F10'},
    {list: '오디오 재생목록', name: 'Hymns', key: 'ContextMenu'},
    {list: '오디오 재생목록', name: 'Hymns', key: 'F10'},
  ])(
    'opens $list with $key and restores focus without choosing it',
    async ({list, name, key}) => {
      const {edit} = setup();
      const opener = await row(list, new RegExp(name));
      const selected = opener.getAttribute('aria-selected');
      act(() => opener.focus());
      fireEvent.keyDown(opener, {key, shiftKey: key === 'F10'});
      const menu = screen.getByRole('menu', {name: '재생목록 메뉴'});
      expect(opener.getAttribute('aria-selected')).toBe(selected);
      expect(edit).not.toHaveBeenCalled();
      fireEvent.keyDown(menu, {key: 'Escape'});
      expect(screen.queryByRole('menu')).toBeNull();
      expect(document.activeElement).toBe(opener);
    },
  );

  it.each([
    ['미디어 목록', 'Backgrounds'],
    ['오디오 재생목록', 'Hymns'],
  ])(
    'lists the %s playlist menu rows in ProPresenter order',
    async (list, name) => {
      setup();
      const contextTarget = await row(list, new RegExp(name));
      fireEvent.contextMenu(contextTarget);
      expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
      const menu = screen.getByRole('menu', {name: '재생목록 메뉴'});
      expect(
        [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
          item =>
            item.getAttribute('role') === 'separator' ? '|' : item.textContent,
        ),
      ).toEqual(['통신에 사용', '|', '이름 바꾸기', '복제', '삭제']);
    },
  );

  afterEach(resetTooltips);

  it.each([
    {kind: 'media', list: '미디어 목록', name: 'Backgrounds', entry: 'pointer'},
    {
      kind: 'media',
      list: '미디어 목록',
      name: 'Backgrounds',
      entry: 'keyboard',
    },
    {kind: 'audio', list: '오디오 재생목록', name: 'Hymns', entry: 'pointer'},
    {kind: 'audio', list: '오디오 재생목록', name: 'Hymns', entry: 'keyboard'},
  ] as const)(
    'keeps the focused $kind rename field after $entry menu cleanup',
    async ({kind, list, name, entry}) => {
      const {edit} = setup();
      const scrollIntoView = HTMLElement.prototype.scrollIntoView;
      HTMLElement.prototype.scrollIntoView = vi.fn();
      onTestFinished(() => {
        HTMLElement.prototype.scrollIntoView = scrollIntoView;
      });
      const opener = await row(list, new RegExp(name));
      act(() => opener.focus());
      if (entry === 'pointer') {
        fireEvent.contextMenu(opener, {clientX: 50, clientY: 50});
      } else fireEvent.keyDown(opener, {key: 'ContextMenu'});
      const command = await screen.findByRole('menuitem', {
        name: '이름 바꾸기',
      });
      if (entry === 'pointer') fireEvent.click(command);
      else {
        fireEvent.keyDown(screen.getByRole('menu'), {key: 'ArrowDown'});
        fireEvent.keyDown(command, {key: 'Enter'});
      }
      const field = await screen.findByRole('textbox', {name: `${name} 이름`});
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
      });
      expect(document.activeElement).toBe(field);
      expect(field.isConnected).toBe(true);
      expect(edit).not.toHaveBeenCalled();
      fireEvent.keyDown(field, {key: 'ContextMenu'});
      expect(screen.queryByRole('menu')).toBeNull();
      fireEvent.change(field, {target: {value: 'Invented revised list'}});
      fireEvent.keyDown(field, {key: 'Enter'});
      await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
      expect(edit).toHaveBeenCalledWith({
        type: 'media.playlist.update',
        baseRevision: 1,
        playlist: {
          kind,
          value:
            kind === 'media'
              ? {
                  id: playlistId(1),
                  name: 'Invented revised list',
                  items: [mediaId(2)],
                }
              : {
                  id: audioPlaylistId(1),
                  name: 'Invented revised list',
                  items: [mediaId(3)],
                  loop: true,
                },
        },
      });
    },
  );

  it.each([
    ['미디어 목록', 'Backgrounds'],
    ['오디오 재생목록', 'Hymns'],
  ])(
    'cancels an existing name in %s after focus restoration (%s)',
    async (list, name) => {
      const {edit} = setup();
      const opener = await row(list, new RegExp(name));
      act(() => opener.focus());
      fireEvent.contextMenu(opener);
      fireEvent.click(
        await screen.findByRole('menuitem', {name: '이름 바꾸기'}),
      );
      const field = await screen.findByRole('textbox', {name: `${name} 이름`});
      expect(document.activeElement).toBe(field);
      fireEvent.change(field, {target: {value: 'Invented cancelled name'}});
      fireEvent.keyDown(field, {key: 'Escape'});
      expect(edit).not.toHaveBeenCalled();
      expect(screen.queryByRole('textbox', {name: `${name} 이름`})).toBeNull();
      expect(await row(list, new RegExp(name))).toBeDefined();
    },
  );

  it.each(['새 재생목록', '새 오디오 재생목록'])(
    'explains why %s is unavailable while loading',
    async name => {
      const document = mediaDocument([]);
      const fixture = mediaFixture(document);
      vi.spyOn(fixture.api.media, 'get').mockReturnValue(
        new Promise(() => undefined),
      );
      setup(document, fixture);
      const button = screen.getByRole('button', {name});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(button);
      expect(fixture.edit).not.toHaveBeenCalled();
      expect((await hoverForTooltip(button))?.textContent).toBe(
        '미디어 불러오는 중',
      );
    },
  );

  it.each(['새 재생목록', '새 오디오 재생목록'])(
    'explains why %s is unavailable for a read-only list',
    async name => {
      setup({...mediaDocument([], 1), access: 'readOnly'});
      await row('미디어 목록', /모든 미디어/);
      const button = screen.getByRole('button', {name});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect((await hoverForTooltip(button))?.textContent).toBe(
        '읽기 전용 미디어 목록',
      );
    },
  );

  it.each(['새 재생목록', '새 오디오 재생목록'])(
    'explains why %s is unavailable while creating and enables it after completion',
    async name => {
      const {edit} = setup();
      let finish: () => void = () => undefined;
      edit.mockReturnValue(
        new Promise(resolve => {
          finish = () => resolve({ok: true, value: null});
        }),
      );
      await row('미디어 목록', /모든 미디어/);
      const button = screen.getByRole('button', {name});
      fireEvent.click(button);
      fireEvent.click(button);
      expect(edit).toHaveBeenCalledOnce();
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect((await hoverForTooltip(button))?.textContent).toBe(
        '재생목록 만드는 중',
      );
      await act(async () => {
        finish();
      });
      expect(button.getAttribute('aria-disabled')).toBeNull();
      resetTooltips();
      expect((await hoverForTooltip(button))?.textContent).toBe(name);
    },
  );
  it('lists 모든 미디어, the playlists, and the audio playlists with their counts', async () => {
    setup();
    const all = await row('미디어 목록', /모든 미디어/);
    expect(all.textContent).toContain('3');
    expect(all.getAttribute('aria-selected')).toBe('true');
    expect((await row('미디어 목록', /Backgrounds/)).textContent).toContain(
      '1',
    );
    expect(
      (await row('미디어 목록', /이름 없는 재생목록/)).textContent,
    ).toContain('0');
    expect((await row('오디오 재생목록', /Hymns/)).textContent).toContain('1');
  });

  it('shows the chosen playlist in the grid and imports into it', async () => {
    const {importFiles} = setup();
    fireEvent.click(await row('미디어 목록', /Backgrounds/));
    const grid = await screen.findByRole('listbox', {name: 'Backgrounds'});
    expect(
      within(grid)
        .getAllByRole('option')
        .map(option => option.getAttribute('aria-label')),
    ).toEqual(['Waves']);
    fireEvent.click(screen.getByRole('button', {name: '가져오기'}));
    expect(importFiles).toHaveBeenCalledWith({
      source: {kind: 'dialog'},
      playlist: {kind: 'media', id: playlistId(1)},
    });
    fireEvent.click(await row('오디오 재생목록', /Hymns/));
    expect(
      (await row('미디어 목록', /Backgrounds/)).getAttribute('aria-selected'),
    ).toBe('false');
    expect(await screen.findByRole('listbox', {name: 'Hymns'})).toBeDefined();
  });

  it('adds a playlist with 새 재생목록 and shows it once the list has it', async () => {
    const {edit, pushDocument} = setup();
    edit.mockResolvedValue({ok: true, value: {id: playlistId(3), revision: 2}});
    await row('미디어 목록', /모든 미디어/);
    fireEvent.click(screen.getByRole('button', {name: '새 재생목록'}));
    expect(edit).toHaveBeenCalledWith({
      type: 'media.playlist.create',
      kind: 'media',
    });
    act(() => {
      pushDocument(
        mediaDocument([mediaItem(1, {name: 'Dawn'})], 2, {
          playlists: [{id: playlistId(3), name: '새 재생목록', items: []}],
        }),
      );
    });
    expect(
      (await row('미디어 목록', /새 재생목록/)).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      await screen.findByRole('listbox', {name: '새 재생목록'}),
    ).toBeDefined();
  });

  it('can add no playlist to a list a newer version wrote', async () => {
    const {edit} = setup({...mediaDocument([], 1), access: 'readOnly'});
    await row('미디어 목록', /모든 미디어/);
    for (const name of ['새 재생목록', '새 오디오 재생목록']) {
      const button = screen.getByRole('button', {name});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(button);
    }
    expect(edit).not.toHaveBeenCalled();
  });

  it('renames a playlist in its row from its menu', async () => {
    const {edit} = setup();
    fireEvent.contextMenu(await row('미디어 목록', /Backgrounds/));
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    const field = await screen.findByRole('textbox', {
      name: 'Backgrounds 이름',
    });
    fireEvent.change(field, {target: {value: 'Morning'}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await vi.waitFor(() =>
      expect(edit).toHaveBeenCalledWith({
        type: 'media.playlist.update',
        playlist: {
          kind: 'media',
          value: {id: playlistId(1), name: 'Morning', items: [mediaId(2)]},
        },
        baseRevision: 1,
      }),
    );
    await vi.waitFor(() =>
      expect(
        screen.queryByRole('textbox', {name: 'Backgrounds 이름'}),
      ).toBeNull(),
    );
  });

  it('deletes an audio playlist after asking', async () => {
    const {edit} = setup();
    fireEvent.contextMenu(await row('오디오 재생목록', /Hymns/));
    fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog.textContent).toContain('Hymns');
    expect(edit).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', {name: '삭제'}));
    await vi.waitFor(() =>
      expect(screen.queryByRole('alertdialog')).toBeNull(),
    );
    expect(edit).toHaveBeenCalledWith({
      type: 'media.playlist.delete',
      playlist: {kind: 'audio', id: audioPlaylistId(1)},
    });
  });

  it('names a new playlist in its row', async () => {
    const {edit, pushDocument} = setup();
    edit.mockResolvedValue({ok: true, value: {id: playlistId(3), revision: 2}});
    await row('미디어 목록', /모든 미디어/);
    fireEvent.click(screen.getByRole('button', {name: '새 재생목록'}));
    await vi.waitFor(() => expect(edit).toHaveBeenCalledOnce());
    act(() => {
      pushDocument(
        mediaDocument([], 2, {
          playlists: [{id: playlistId(3), name: '새 재생목록', items: []}],
        }),
      );
    });
    const field = await screen.findByRole('textbox', {
      name: '새 재생목록 이름',
    });
    expect(document.activeElement).toBe(field);
  });

  it('offers no menu on 모든 미디어', async () => {
    setup();
    fireEvent.contextMenu(await row('미디어 목록', /모든 미디어/));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('takes media out of the chosen playlist from its tile', async () => {
    const {edit} = setup();
    fireEvent.click(await row('미디어 목록', /Backgrounds/));
    const grid = await screen.findByRole('listbox', {name: 'Backgrounds'});
    fireEvent.contextMenu(within(grid).getByRole('option', {name: 'Waves'}));
    expect(
      screen
        .getAllByRole('menuitem')
        .filter(item => item.getAttribute('aria-disabled') !== 'true')
        .map(item => item.textContent),
    ).toEqual(['속성…', '재생목록에서 빼기', '삭제']);
    fireEvent.click(screen.getByRole('menuitem', {name: '재생목록에서 빼기'}));
    await vi.waitFor(() =>
      expect(edit).toHaveBeenCalledWith({
        type: 'media.playlist.update',
        playlist: {
          kind: 'media',
          value: {id: playlistId(1), name: 'Backgrounds', items: []},
        },
        baseRevision: 1,
      }),
    );
  });
});
