import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import {SUNDAY_NOTICE_PICTURE_ID} from '@core/themes/sundayNotice';
import {
  createMediaId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {applyService, openItem} from '@renderer/session/show';
import {
  hoverForTooltip,
  resetTooltips,
} from '@fixtures/renderer/ui/tooltipTesting';
import {mockMenuRowHeight} from '@fixtures/renderer/features/songs/editor/editorTesting';
import * as backgroundHook from '@renderer/features/service/items/useSongBackground';
import {
  SongBackgroundControl,
  SongBackgroundSelect,
} from '@renderer/features/service/details/SongBackgroundControl';

const image: MediaItem = {
  id: createMediaId('30000000-0000-4000-8000-000000000001'),
  name: '따뜻한 빛',
  kind: 'image',
  file: 'invented.png',
  size: 1,
};
const video: MediaItem = {
  id: createMediaId('30000000-0000-4000-8000-000000000002'),
  name: '고요한 물결',
  kind: 'video',
  file: 'invented.mp4',
  size: 1,
};
const audio: MediaItem = {
  id: createMediaId('30000000-0000-4000-8000-000000000003'),
  name: '안내 소리',
  kind: 'audio',
  file: 'invented.wav',
  size: 1,
};
const items = [image, video, audio];
type SelectProps = ComponentProps<typeof SongBackgroundSelect>;
const selection = {mediaId: image.id, inherited: true, missing: false};

function setup(props: Partial<Omit<SelectProps, 'onChoose'>> = {}) {
  const onChoose = vi.fn();
  const view = render(
    <SongBackgroundSelect
      items={items}
      defaultMediaId={image.id}
      selection={selection}
      {...props}
      onChoose={onChoose}
    />,
  );
  return {...view, onChoose, user: userEvent.setup()};
}
beforeEach(() => {
  resetTooltips();
  mockMenuRowHeight();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  );
});
afterEach(() => {
  cleanup();
  applyService(null);
  resetTooltips();
});

describe('slide-header background control', () => {
  it('shows the inherited image and opens image/video choices with ArrowDown', async () => {
    const {container, onChoose, user} = setup();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      mediaUrl(image.id),
    );
    const button = screen.getByRole('button', {name: '배경 선택'});
    button.focus();
    await user.keyboard('{ArrowDown}');
    const list = screen.getByRole('listbox', {name: '배경 선택'});
    expect(
      [...list.querySelectorAll('[role="option"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator'
            ? '-'
            : row.getAttribute('aria-label'),
      ),
    ).toEqual(['곡 기본값', '-', image.name, video.name]);
    expect(screen.getByRole('option', {name: '곡 기본값'}).textContent).toBe(
      `곡 기본값${image.name}`,
    );
    expect(
      screen
        .getByRole('option', {name: '곡 기본값'})
        .getAttribute('aria-description'),
    ).toBe(image.name);
    expect(screen.queryByRole('option', {name: '없음'})).toBeNull();
    expect(
      screen
        .getByRole('option', {name: '곡 기본값'})
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByRole('option', {name: audio.name})).toBeNull();
    await user.click(screen.getByRole('option', {name: video.name}));
    expect(onChoose).toHaveBeenCalledWith(video.id);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(screen.getByText(image.name)).toBeDefined();
  });

  it('removes an override by choosing the song default', async () => {
    const {onChoose, user} = setup({
      selection: {...selection, mediaId: video.id, inherited: false},
    });
    await user.click(screen.getByRole('button', {name: '배경 선택'}));
    expect(screen.getByRole('option', {name: '곡 기본값'}).textContent).toBe(
      `곡 기본값${image.name}`,
    );
    expect(
      screen
        .getByRole('option', {name: video.name})
        .getAttribute('aria-selected'),
    ).toBe('true');
    await user.click(screen.getByRole('option', {name: '곡 기본값'}));
    expect(onChoose).toHaveBeenCalledWith(null);
  });

  it('filters media names with the shared menu search and resets the query on reopening', async () => {
    const {user, onChoose} = setup();
    const button = screen.getByRole('button', {name: '배경 선택'});
    await user.click(button);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), '  고요  ');
    expect(screen.queryByRole('option', {name: image.name})).toBeNull();
    expect(screen.getByRole('option', {name: video.name})).toBeDefined();
    expect(screen.getByRole('option', {name: '곡 기본값'})).toBeDefined();
    expect(onChoose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(button);
    await user.click(button);
    expect(screen.getByRole('combobox')).toHaveProperty('value', '');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    await user.type(screen.getByRole('combobox'), '고요');
    await user.click(screen.getByRole('option', {name: video.name}));
    expect(onChoose).toHaveBeenCalledWith(video.id);
  });

  it('shows the cached video thumbnail without a decoder and follows the selection', () => {
    const {container, rerender, onChoose} = setup({
      selection: {...selection, mediaId: video.id},
    });
    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      thumbnailUrl(video.id),
    );
    rerender(
      <SongBackgroundSelect
        items={items}
        selection={selection}
        onChoose={onChoose}
      />,
    );
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      mediaUrl(image.id),
    );
  });

  it.each([{readOnly: true}, {busy: true}])(
    'refuses choices when disabled by %o',
    async props => {
      const {onChoose, user} = setup(props);
      const button = screen.getByRole('button', {name: '배경 선택'});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      await user.click(button);
      fireEvent.keyDown(button, {key: 'ArrowDown'});
      expect(screen.queryByRole('listbox')).toBeNull();
      expect(onChoose).not.toHaveBeenCalled();
      expect((await hoverForTooltip(button))?.textContent).toBe(
        'readOnly' in props
          ? '새 버전의 파일이라 바꿀 수 없습니다'
          : '배경 변경 중',
      );
    },
  );

  it('names a missing background and lets the operator choose its replacement', async () => {
    const {container, user, onChoose} = setup({
      selection: {...selection, missing: true},
    });
    expect(
      screen.getByRole('img', {
        name: '배경 파일을 찾을 수 없습니다: 따뜻한 빛. 다른 배경을 선택하세요.',
      }),
    ).toBeDefined();
    expect(container.querySelector('img')).toBeNull();
    expect(screen.queryByRole('button', {name: '다시 연결'})).toBeNull();
    await user.click(screen.getByRole('button', {name: '배경 선택'}));
    await user.click(screen.getByRole('option', {name: video.name}));
    expect(onChoose).toHaveBeenCalledWith(video.id);
  });

  it('never warns for an empty background even if a stale missing flag arrives', () => {
    setup({selection: {mediaId: undefined, inherited: true, missing: true}});
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getByRole('button', {name: '배경 선택'}).textContent,
    ).toContain('없음');
  });

  it('names a bundled background without treating its absent catalog entry as missing', () => {
    setup({
      items: [],
      selection: {
        mediaId: SUNDAY_NOTICE_PICTURE_ID,
        inherited: false,
        missing: false,
      },
    });
    expect(screen.queryByRole('img')).toBeNull();
    expect(
      screen.getByRole('button', {name: '배경 선택'}).textContent,
    ).toContain('광고 배경');
  });

  it('binds the selected item and host callback to the controller', async () => {
    const id = createServiceItemId('10000000-0000-4000-8000-000000000001');
    const onProblem = vi.fn();
    const choose = vi.fn();
    const hook = vi.spyOn(backgroundHook, 'useSongBackground').mockReturnValue({
      busy: false,
      choose,
      view: {
        serviceId: 'service',
        item: {
          slides: [],
          id,
          song: createSongId('20000000-0000-4000-8000-000000000001'),
          background: image.id,
        },
        song: null,
        readOnly: false,
        media: {
          name: 'media',
          revision: 1,
          access: 'editable',
          value: {
            format: 'llmedia',
            schemaVersion: 1,
            items,
            playlists: [],
            audioPlaylists: [],
          },
        },
      },
    });
    applyService({
      id: 'service',
      name: 'Invented service',
      revision: 1,
      readOnly: false,
      rows: [{kind: 'song', id, title: 'Invented song'}],
      tiles: {},
      jumpKeys: {},
    });
    openItem(id);
    render(<SongBackgroundControl onProblem={onProblem} />);
    expect(hook).toHaveBeenCalledWith(onProblem);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', {name: '배경 선택'}));
    await user.click(screen.getByRole('option', {name: video.name}));
    expect(choose).toHaveBeenCalledWith(video.id);
  });
});
