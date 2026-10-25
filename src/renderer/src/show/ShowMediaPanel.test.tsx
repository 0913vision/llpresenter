import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {createMediaId, createMediaPlaylistId} from '@shared/schema/ids';
import {
  parseMediaDocument,
  type MediaDocument,
  type MediaImportProgress,
} from '@shared/schema/mediaEdit';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';
import {useShowKeys} from './shortcuts';
import {ShowMediaPanel} from './ShowMediaPanel';

function id(index: number) {
  return createMediaId(
    `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
  );
}

function fixture(count = 3, kind?: 'video') {
  const parsed = parseMediaDocument({
    name: 'media',
    revision: 1,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      items: Array.from({length: count}, (_, index) => ({
        id: id(index + 1),
        name: `미디어 ${index}`,
        size: 1,
        kind: kind ?? (index === 1 ? 'video' : index === 2 ? 'audio' : 'image'),
        file: `invented-${index}`,
        ...(kind === 'video' || index === 1
          ? {duration: 90, props: {end: 'stop'}}
          : {}),
      })),
      playlists: [
        {
          id: createMediaPlaylistId('50000000-0000-4000-8000-000000000001'),
          name: '영상',
          items: [id(2)],
        },
      ],
      audioPlaylists: [],
    },
  });
  if (!parsed.ok) throw new Error('Invalid invented strip fixture');
  let progress: (job: MediaImportProgress) => void = () => undefined;
  let push: (document: MediaDocument) => void = () => undefined;
  const send = vi.fn();
  const report = vi.fn();
  const api = fakeLlpApi({
    live: {send},
    media: {
      get: async () => parsed.value,
      subscribe: listener => {
        push = listener;
        return () => undefined;
      },
      subscribeImports: listener => {
        progress = listener;
        return () => undefined;
      },
    },
  });
  window.llp = api;
  useLive.setState({state: emptyLiveState()});
  return {
    api,
    send,
    report,
    document: parsed.value,
    push: (document: MediaDocument) => push(document),
    progress: (job: MediaImportProgress) => progress(job),
  };
}

beforeEach(() => {
  const readStyle = window.getComputedStyle.bind(window);
  vi.spyOn(globalThis, 'getComputedStyle').mockImplementation(
    (element, pseudo) => {
      if (element.getAttribute('role') === 'listbox') {
        const css = document.createElement('div').style;
        css.setProperty('--size-media-strip-tile', '150px');
        css.columnGap = '12px';
        css.paddingLeft = '4px';
        return css;
      }
      return readStyle(element, pseudo);
    },
  );
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(480);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  resetTooltips();
});

it('filters audio, switches playlists, and marks LIVE only when main confirms the background', async () => {
  const {send, report} = fixture();
  const user = userEvent.setup();
  render(<ShowMediaPanel onProblem={report} />);
  const image = await screen.findByRole('option', {name: '미디어 0'});
  expect(screen.queryByRole('option', {name: '미디어 2'})).toBeNull();
  await user.click(image);
  expect(send).toHaveBeenCalledExactlyOnceWith({
    type: 'media.show',
    media: {mediaId: id(1), loop: true},
  });
  expect(image.getAttribute('data-state')).toBeNull();
  const base = emptyLiveState();
  act(() =>
    useLive.setState({
      state: {
        ...base,
        layers: {
          ...base.layers,
          media: {mediaId: id(1), loop: true, startedAt: 1},
        },
      },
    }),
  );
  expect(image.getAttribute('data-state')).toBe('live');
  await user.click(screen.getByRole('button', {name: '미디어 재생 목록'}));
  await user.click(screen.getByRole('menuitemradio', {name: '영상'}));
  expect(screen.queryByRole('option', {name: '미디어 0'})).toBeNull();
  expect(screen.getByRole('option', {name: '미디어 1'}).textContent).toContain(
    '1:30',
  );
  await user.click(screen.getByRole('option', {name: '미디어 1'}));
  expect(send).toHaveBeenLastCalledWith({
    type: 'media.show',
    media: {mediaId: id(2), loop: false},
  });
});

it('keeps keyboard focus on the prior control after a media click in 진행', async () => {
  const {report} = fixture();
  function Host() {
    useShowKeys();
    return (
      <>
        <button type="button">기존 위치</button>
        <ShowMediaPanel onProblem={report} />
      </>
    );
  }
  render(<Host />);
  const prior = screen.getByRole('button', {name: '기존 위치'});
  prior.focus();
  await userEvent.click(await screen.findByRole('option', {name: '미디어 0'}));
  expect(document.activeElement).toBe(prior);
});

it('renders active copy progress without allowing output', async () => {
  const {progress, send, report} = fixture();
  render(<ShowMediaPanel onProblem={report} />);
  await screen.findByRole('option', {name: '미디어 0'});
  const job = {mediaId: id(4), fileName: 'invented-copy.mp4'};
  act(() => progress({...job, phase: 'copying', percent: 37}));
  const tile = screen.getByRole('option', {name: job.fileName});
  expect(tile.getAttribute('aria-disabled')).toBe('true');
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
    '37',
  );
  await userEvent.click(tile);
  tile.focus();
  await userEvent.keyboard('{Enter}');
  expect(send).not.toHaveBeenCalled();
  act(() => progress({...job, phase: 'cancelled', percent: 37}));
  expect(screen.queryByRole('option', {name: job.fileName})).toBeNull();
});

it('shows missing-file state after a current preview failure and keeps import/relink unavailable', async () => {
  const {api, send, report} = fixture();
  const edit = vi.spyOn(api.media, 'edit');
  render(<ShowMediaPanel onProblem={report} />);
  const tile = await screen.findByRole('option', {name: '미디어 0'});
  const image = tile.querySelector('img');
  if (!image) throw new Error('Missing image preview');
  fireEvent.error(image);
  expect(tile.getAttribute('data-state')).toBe('warning');
  expect(tile.querySelector('img')).toBeNull();
  await userEvent.click(tile);
  expect(send).not.toHaveBeenCalled();
  expect(edit).not.toHaveBeenCalled();
  expect(report).toHaveBeenCalledWith(
    expect.objectContaining({
      title: '미디어 다시 연결할 수 없음',
      meta: ['미디어 0'],
    }),
  );
  const button = screen.getByRole('button', {name: '가져오기'});
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect((await hoverForTooltip(button))?.textContent).toBe(
    '현재 버전에서는 미디어 파일을 가져올 수 없음',
  );
});

it('keeps video previews paused and releases the source on unmount', async () => {
  const {report} = fixture();
  const {container, unmount} = render(<ShowMediaPanel onProblem={report} />);
  await screen.findByRole('option', {name: '미디어 1'});
  const video = container.querySelector('video');
  if (!video) throw new Error('Missing video preview');
  expect(video.muted).toBe(true);
  expect(video.autoplay).toBe(false);
  expect(video.preload).toBe('metadata');
  await userEvent.click(screen.getByRole('option', {name: '미디어 1'}));
  const base = emptyLiveState();
  act(() =>
    useLive.setState({
      state: {
        ...base,
        layers: {
          ...base.layers,
          media: {mediaId: id(2), loop: false, startedAt: 1},
        },
      },
    }),
  );
  expect(container.querySelector('video')).toBe(video);
  expect(video.pause).not.toHaveBeenCalled();
  unmount();
  expect(video.getAttribute('src')).toBeNull();
  expect(video.pause).toHaveBeenCalledOnce();
  expect(video.load).toHaveBeenCalledOnce();
});

it('windows a thousand-item row and navigates to an unmounted item with the keyboard', async () => {
  const disconnect = vi.fn();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      disconnect = disconnect;
    },
  );
  const {report, send} = fixture(1000);
  const {unmount} = render(<ShowMediaPanel onProblem={report} />);
  await screen.findByRole('option', {name: '미디어 0'});
  const strip = screen.getByRole('listbox', {name: '미디어'});
  expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(14);
  Object.defineProperty(strip, 'clientWidth', {value: 480, configurable: true});
  strip.style.setProperty('--size-media-strip-tile', '150px');
  strip.style.columnGap = '12px';
  strip.scrollLeft = 500 * 162;
  fireEvent.scroll(strip);
  await screen.findByRole('option', {name: '미디어 500'});
  expect(screen.queryByRole('option', {name: '미디어 0'})).toBeNull();
  expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(14);
  screen.getAllByRole('option')[0]?.focus();
  await userEvent.keyboard('{End}');
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('option', {name: '미디어 999'}),
    ),
  );
  expect(strip.getAttribute('aria-orientation')).toBe('horizontal');
  expect(document.activeElement?.getAttribute('aria-setsize')).toBe('999');
  expect(document.activeElement?.getAttribute('aria-posinset')).toBe('999');
  await userEvent.keyboard('{ArrowLeft}{Enter}');
  expect(send).toHaveBeenLastCalledWith({
    type: 'media.show',
    media: {mediaId: id(999), loop: true},
  });
  unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

it('caps video elements at eight in a wide measured viewport and gives none to overscan tiles', async () => {
  const {report} = fixture(100, 'video');
  const {container} = render(<ShowMediaPanel onProblem={report} />);
  await screen.findByRole('option', {name: '미디어 0'});
  expect(container.querySelectorAll('video')).toHaveLength(3);
  expect(
    screen.getByRole('option', {name: '미디어 4'}).querySelector('video'),
  ).toBeNull();
  const strip = screen.getByRole('listbox', {name: '미디어'});
  Object.defineProperty(strip, 'clientWidth', {
    value: 3440,
    configurable: true,
  });
  fireEvent.scroll(strip);
  expect(container.querySelectorAll('video')).toHaveLength(8);
  strip.scrollLeft = 20 * 162 + 75;
  fireEvent.scroll(strip);
  expect(container.querySelectorAll('video')).toHaveLength(8);
  expect(
    screen.getByRole('option', {name: '미디어 16'}).querySelector('video'),
  ).toBeNull();
  expect(
    screen.getByRole('option', {name: '미디어 20'}).querySelector('video'),
  ).not.toBeNull();
  strip.scrollLeft = 20 * 162 + 155;
  fireEvent.scroll(strip);
  expect(container.querySelectorAll('video')).toHaveLength(8);
  expect(
    screen.getByRole('option', {name: '미디어 20'}).querySelector('video'),
  ).toBeNull();
  expect(
    screen.getByRole('option', {name: '미디어 21'}).querySelector('video'),
  ).not.toBeNull();
});

it('keeps a video across unrelated document changes and replaces it only when its file changes', async () => {
  const {report, push, document: original} = fixture();
  const {container} = render(<ShowMediaPanel onProblem={report} />);
  await screen.findByRole('option', {name: '미디어 1'});
  const video = container.querySelector('video');
  if (!video) throw new Error('Missing video preview');
  const renamed = parseMediaDocument({
    ...original,
    revision: 2,
    value: {
      ...original.value,
      items: original.value.items.map(item =>
        item.id === id(1) ? {...item, name: '새 이름'} : item,
      ),
    },
  });
  if (!renamed.ok) throw new Error('Invalid renamed fixture');
  act(() => push(renamed.value));
  expect(container.querySelector('video')).toBe(video);
  expect(video.pause).not.toHaveBeenCalled();
  const relinked = parseMediaDocument({
    ...renamed.value,
    revision: 3,
    value: {
      ...renamed.value.value,
      items: renamed.value.value.items.map(item =>
        item.id === id(2) ? {...item, file: 'relinked.mp4'} : item,
      ),
    },
  });
  if (!relinked.ok) throw new Error('Invalid relinked fixture');
  act(() => push(relinked.value));
  expect(container.querySelector('video')).not.toBe(video);
  expect(video.getAttribute('src')).toBeNull();
  expect(video.pause).toHaveBeenCalledOnce();
});
