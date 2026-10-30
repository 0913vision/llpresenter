import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {mediaUrl} from '@contracts/ipc/media';
import {
  createMediaId,
  createServiceItemId,
  createSongId,
} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {applyService, openItem} from '@renderer/state/show';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import * as backgroundHook from './useSongBackground';
import {
  SongBackgroundControl,
  SongBackgroundSelect,
} from './SongBackgroundControl';

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
      selection={selection}
      {...props}
      onChoose={onChoose}
    />,
  );
  return {...view, onChoose, user: userEvent.setup()};
}
beforeEach(() => {
  resetTooltips();
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
  it.each([true, false])(
    'discloses item scope and live impact with inherited=%s without editing',
    async inherited => {
      const {onChoose} = setup({selection: {...selection, inherited}});
      const tooltip = await hoverForTooltip(
        screen.getByRole('button', {name: '배경 선택'}),
      );
      expect(tooltip?.textContent).toBe(
        '이 항목에만 적용합니다. 출력 중인 항목이면 배경이 바로 바뀝니다',
      );
      expect(onChoose).not.toHaveBeenCalled();
    },
  );

  it('shows the inherited image and opens image/video choices with ArrowDown', async () => {
    const {container, onChoose, user} = setup();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      mediaUrl(image.id),
    );
    const button = screen.getByRole('button', {name: '배경 선택'});
    button.focus();
    await user.keyboard('{ArrowDown}');
    expect(
      screen
        .getByRole('menuitemradio', {name: '곡 기본값'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.queryByRole('menuitemradio', {name: audio.name})).toBeNull();
    await user.click(screen.getByRole('menuitemradio', {name: video.name}));
    expect(onChoose).toHaveBeenCalledWith(video.id);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByText(image.name)).toBeDefined();
  });

  it('removes an override by choosing the song default', async () => {
    const {onChoose, user} = setup({
      selection: {...selection, mediaId: video.id, inherited: false},
    });
    await user.click(screen.getByRole('button', {name: '배경 선택'}));
    expect(
      screen
        .getByRole('menuitemradio', {name: video.name})
        .getAttribute('aria-checked'),
    ).toBe('true');
    await user.click(screen.getByRole('menuitemradio', {name: '곡 기본값'}));
    expect(onChoose).toHaveBeenCalledWith(null);
  });

  it('filters media names with the shared menu search and resets the query on reopening', async () => {
    const {user, onChoose} = setup();
    const button = screen.getByRole('button', {name: '배경 선택'});
    await user.click(button);
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    await user.type(screen.getByRole('combobox'), '  고요  ');
    expect(screen.queryByRole('menuitemradio', {name: image.name})).toBeNull();
    expect(screen.getByRole('menuitemradio', {name: video.name})).toBeDefined();
    expect(
      screen.getByRole('menuitemradio', {name: '곡 기본값'}),
    ).toBeDefined();
    expect(onChoose).not.toHaveBeenCalled();
    await user.keyboard('{Escape}');
    expect(document.activeElement).toBe(button);
    await user.click(button);
    expect(screen.getByRole('combobox')).toHaveProperty('value', '');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(3);
    await user.type(screen.getByRole('combobox'), '고요');
    await user.click(screen.getByRole('menuitemradio', {name: video.name}));
    expect(onChoose).toHaveBeenCalledWith(video.id);
  });

  it('keeps the video paused and releases its source when the selection changes', () => {
    const {container, rerender, onChoose} = setup({
      selection: {...selection, mediaId: video.id},
    });
    const element = container.querySelector('video');
    if (element === null) throw new Error('Missing video thumbnail');
    expect(element.muted).toBe(true);
    expect(element.autoplay).toBe(false);
    expect(element.preload).toBe('metadata');
    expect(element.getAttribute('src')).toBe(mediaUrl(video.id));
    rerender(
      <SongBackgroundSelect
        items={items}
        selection={selection}
        onChoose={onChoose}
      />,
    );
    expect(element.getAttribute('src')).toBeNull();
    expect(element.pause).toHaveBeenCalledOnce();
    expect(element.load).toHaveBeenCalledOnce();
  });

  it.each([{readOnly: true}, {busy: true}])(
    'refuses choices when disabled by %o',
    async props => {
      const {onChoose, user} = setup(props);
      const button = screen.getByRole('button', {name: '배경 선택'});
      expect(button.getAttribute('aria-disabled')).toBe('true');
      await user.click(button);
      fireEvent.keyDown(button, {key: 'ArrowDown'});
      expect(screen.queryByRole('menu')).toBeNull();
      expect(onChoose).not.toHaveBeenCalled();
      expect((await hoverForTooltip(button))?.textContent).toBe(
        'readOnly' in props ? '읽기 전용 예배 순서' : '배경 변경 중',
      );
    },
  );

  it('marks a missing background and explains why relinking is unavailable', async () => {
    const {container, user} = setup({selection: {...selection, missing: true}});
    expect(
      screen.getByRole('img', {name: '배경 파일을 찾을 수 없음'}),
    ).toBeDefined();
    expect(container.querySelector('img')).toBeNull();
    const relink = screen.getByRole('button', {name: '다시 연결'});
    expect(relink.getAttribute('aria-disabled')).toBe('true');
    await user.click(relink);
    expect((await hoverForTooltip(relink))?.textContent).toBe(
      '현재 버전에서는 미디어 파일을 다시 연결할 수 없음',
    );
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
    await user.click(screen.getByRole('menuitemradio', {name: video.name}));
    expect(choose).toHaveBeenCalledWith(video.id);
  });
});
