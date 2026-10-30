import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, emptyLiveState, type LiveLayers} from '@core/live/state';
import {mediaUrl} from '@contracts/ipc/media';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {useLive} from '@renderer/session/live';
import {showLarge, usePreview} from '@renderer/session/preview';
import {
  openItem,
  outputTile,
  selectTile,
  useShow,
} from '@renderer/session/show';
import {PreviewPanel} from './PreviewPanel';
import {seedSampleService} from '../../session/testing/sampleService';
import {renderWithScreenSummaries as render} from '@renderer/app/shell/testing/screenSummaries';

interface Instance {
  readonly parent: HTMLElement;
  readonly options: {
    readonly lyricStyle: unknown;
    readonly mediaUrl: unknown;
    readonly onError: (message: string, error: unknown) => void;
    readonly mode: unknown;
  };
  readonly render: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

const instances = vi.hoisted(() => {
  const list: unknown[] = [];
  return {list};
});

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    readonly render = vi.fn();
    readonly dispose = vi.fn();
    constructor(
      readonly parent: HTMLElement,
      readonly options: unknown,
    ) {
      instances.list.push(this);
    }
  },
}));

function created(): readonly Instance[] {
  return instances.list.filter(
    (value): value is Instance =>
      typeof value === 'object' && value !== null && 'render' in value,
  );
}

function drawCounts(): readonly number[] {
  return created().map(instance => instance.render.mock.calls.length);
}

function setLayers(layers: Partial<LiveLayers>, on: Record<string, boolean>) {
  useLive.setState({
    state: {
      ...emptyLiveState(),
      layers: {...emptyLayers(), ...layers},
      outputs: on,
    },
  });
}

function itemOf(container: HTMLElement, screenId: string): HTMLElement {
  const item = container.querySelector<HTMLElement>(
    `[data-screen="${screenId}"]`,
  );
  if (!item) throw new Error(`The ${screenId} preview is missing`);
  return item;
}

function screensWithRole(
  container: HTMLElement,
  role: string,
): ReadonlyArray<string | undefined> {
  return Array.from(
    container.querySelectorAll<HTMLElement>(`[data-role="${role}"]`),
  ).map(item => item.dataset['screen']);
}

function screenOrder(
  container: HTMLElement,
): ReadonlyArray<string | undefined> {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-screen]'),
  ).map(item => item.dataset['screen']);
}

const allOn = {main: true, stage: true, broadcast: true};
const slide = {itemId: 'a', position: 0, label: null, lines: ['x']};

beforeEach(() => {
  instances.list.length = 0;
  usePreview.setState({largeScreenId: 'main'});
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
  window.llp = fakeLlpApi();
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

describe('PreviewPanel layout', () => {
  it('shows the 본 화면 large and the other two small, in order', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    expect(screensWithRole(container, 'large')).toEqual(['main']);
    expect(screensWithRole(container, 'small')).toEqual(['stage', 'broadcast']);
  });

  it('keeps the three previews in the same order in the tree whichever is large', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    expect(screenOrder(container)).toEqual(['main', 'stage', 'broadcast']);
    act(() => showLarge('broadcast'));
    expect(screenOrder(container)).toEqual(['main', 'stage', 'broadcast']);
  });

  it('makes a small preview large when it is clicked, and the large one small', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: /무대 화면/}));
    expect(usePreview.getState().largeScreenId).toBe('stage');
    expect(screensWithRole(container, 'large')).toEqual(['stage']);
    expect(screensWithRole(container, 'small')).toEqual(['main', 'broadcast']);
  });

  it('keeps the small ones in the fixed order whichever screen is large', () => {
    setLayers({}, allOn);
    showLarge('broadcast');
    const {container} = render(<PreviewPanel compact={false} />);
    expect(screensWithRole(container, 'small')).toEqual(['main', 'stage']);
  });

  it('does not make the large preview a button', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    expect(itemOf(container, 'main').querySelector('button')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(
      screen.getByRole('button', {pressed: true}).dataset['previewSlot'],
    ).toBe('main');
  });

  it('falls back to the 본 화면 when the large screen is unknown', () => {
    setLayers({}, allOn);
    showLarge('gone');
    const {container} = render(<PreviewPanel compact={false} />);
    expect(screensWithRole(container, 'large')).toEqual(['main']);
  });

  it('shows targets only under the large picture and names in all fixed slots', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    expect(screen.getAllByText('본 화면')).toHaveLength(2);
    expect(screen.getByText('창')).toBeTruthy();
    expect(screen.getByText('무대 화면')).toBeTruthy();
    expect(screen.getByText('방송 자막')).toBeTruthy();
    expect(screen.queryByText('모니터 3')).toBeNull();
    expect(screen.queryByText('NDI')).toBeNull();
  });

  it('writes no Look or stage layout name until the screen settings exist', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    for (const name of ['기본', '현재와 다음', '하단 자막']) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it.each([false, true])(
    'keeps three fixed slots and one marker across every selection, compact=%s',
    compact => {
      const send = vi.fn();
      window.llp = fakeLlpApi({live: {send}});
      setLayers({}, allOn);
      const {container} = render(<PreviewPanel compact={compact} />);
      for (const id of ['main', 'stage', 'broadcast', 'main']) {
        const button = container.querySelector(`[data-preview-slot="${id}"]`);
        if (!button) throw new Error(`Missing fixed slot: ${id}`);
        fireEvent.click(button);
        expect(
          screen
            .getAllByRole('button')
            .map(slot => slot.dataset['previewSlot']),
        ).toEqual(['main', 'stage', 'broadcast']);
        expect(screensWithRole(container, 'large')).toEqual([id]);
        expect(
          container.querySelectorAll('[data-selected-marker]'),
        ).toHaveLength(1);
        expect(button.getAttribute('aria-pressed')).toBe('true');
        expect(button.querySelector('video, img, [data-screen]')).toBeNull();
        expect(created()).toHaveLength(3);
      }
      expect(send).not.toHaveBeenCalled();
      expect(useLive.getState().state?.outputs).toEqual(allOn);
    },
  );
});

describe('PreviewPanel swap', () => {
  it('builds no renderer, disposes none, and draws nothing again on a swap', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    const before = created();
    const counts = drawCounts();
    fireEvent.click(screen.getByRole('button', {name: /무대 화면/}));
    fireEvent.click(screen.getByRole('button', {name: /방송 자막/}));
    expect(created()).toHaveLength(3);
    expect(created()).toEqual(before);
    for (const instance of created()) {
      expect(instance.dispose).not.toHaveBeenCalled();
    }
    expect(drawCounts()).toEqual(counts);
  });

  it('keeps the element that holds each renderer, so a video is not reloaded', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    const parents = created().map(instance => instance.parent);
    fireEvent.click(screen.getByRole('button', {name: /방송 자막/}));
    fireEvent.click(screen.getByRole('button', {name: /본 화면/}));
    for (const [index, instance] of created().entries()) {
      expect(instance.parent).toBe(parents[index]);
      expect(instance.parent.isConnected).toBe(true);
    }
  });

  it('keeps drawing the live layers on every renderer after a swap', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: /무대 화면/}));
    act(() => setLayers({}, allOn));
    for (const instance of created()) {
      expect(instance.render).toHaveBeenLastCalledWith(
        expect.objectContaining({slide: null}),
      );
    }
  });
});

describe('PreviewPanel states', () => {
  it('dims the name of a screen whose output is off and keeps drawing it', () => {
    setLayers({slide}, {main: false, stage: true, broadcast: true});
    const {container} = render(<PreviewPanel compact={false} />);
    const large = itemOf(container, 'main');
    expect(large.getAttribute('data-state')).toBe('off');
    expect(
      screen.getByRole('button', {pressed: true}).getAttribute('aria-label'),
    ).toBe('본 화면 크게 보기, 출력이 꺼져 있습니다');
    expect(created()[0]?.render).toHaveBeenLastCalledWith(
      expect.objectContaining({slide}),
    );
  });

  it('marks a small preview whose output is off', () => {
    setLayers({}, {main: true, stage: false, broadcast: true});
    const {container} = render(<PreviewPanel compact={false} />);
    const stage = itemOf(container, 'stage');
    expect(stage.getAttribute('data-state')).toBe('off');
    expect(
      screen.getByRole('button', {
        name: '무대 화면 크게 보기, 출력이 꺼져 있습니다',
      }),
    ).toBeTruthy();
  });

  it('treats a screen the live state does not know as off', () => {
    setLayers({}, {});
    const {container} = render(<PreviewPanel compact={false} />);
    expect(itemOf(container, 'main').getAttribute('data-state')).toBe('off');
  });

  it('draws only the 방송 자막 frame green, and the others black', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    for (const id of ['main', 'stage']) {
      expect(
        itemOf(container, id).querySelector('[class*="chroma"]'),
      ).toBeNull();
    }
    expect(
      itemOf(container, 'broadcast').querySelector('[class*="chroma"]'),
    ).not.toBeNull();
  });

  it('keeps the green frame on the 방송 자막 after a swap', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: /방송 자막/}));
    for (const id of ['main', 'stage']) {
      expect(
        itemOf(container, id).querySelector('[class*="chroma"]'),
      ).toBeNull();
    }
    expect(
      itemOf(container, 'broadcast').querySelector('[class*="chroma"]'),
    ).not.toBeNull();
  });

  it('fits only the large frame into its box', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    expect(container.querySelectorAll('[class*="fit"]')).toHaveLength(1);
    expect(
      itemOf(container, 'main').querySelector('[class*="fit"]'),
    ).not.toBeNull();
    fireEvent.click(screen.getByRole('button', {name: /무대 화면/}));
    expect(
      itemOf(container, 'stage').querySelector('[class*="fit"]'),
    ).not.toBeNull();
    expect(
      itemOf(container, 'main').querySelector('[class*="fit"]'),
    ).toBeNull();
  });
});

describe('PreviewPanel pictures', () => {
  it('mounts one output renderer per screen with the default lyric style and the media URL', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    const list = created();
    expect(list).toHaveLength(3);
    for (const instance of list) {
      expect(instance.options.lyricStyle).toBe(DEFAULT_LYRIC_STYLE);
      expect(instance.options.mediaUrl).toBe(mediaUrl);
    }
  });

  it('mounts every renderer in the preview mode, so a looping background keeps one video', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    expect(created().map(instance => instance.options.mode)).toEqual([
      'preview',
      'preview',
      'preview',
    ]);
  });

  it('draws the live layers on every renderer at once', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    for (const instance of created()) {
      expect(instance.render).toHaveBeenLastCalledWith(
        expect.objectContaining({slide}),
      );
    }
  });

  it('follows a change of the live state on every renderer without remounting', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    act(() => setLayers({}, allOn));
    for (const instance of created()) {
      expect(instance.render).toHaveBeenLastCalledWith(
        expect.objectContaining({slide: null}),
      );
    }
    expect(created()).toHaveLength(3);
  });

  it('draws empty layers before the first live state arrives', () => {
    render(<PreviewPanel compact={false} />);
    for (const instance of created()) {
      expect(instance.render).toHaveBeenLastCalledWith(emptyLayers());
    }
  });

  it('does not follow the selection: a real selection change draws and builds nothing', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    const before = created();
    const counts = drawCounts();
    act(() => openItem('song-river'));
    act(() => selectTile(2));
    act(() => openItem('song-morning'));
    act(() => selectTile(2));
    expect(useShow.getState().openItemId).toBe('song-morning');
    expect(created()).toEqual(before);
    expect(drawCounts()).toEqual(counts);
    for (const instance of created()) {
      expect(instance.dispose).not.toHaveBeenCalled();
    }
  });

  it('changes only when the live state changes: outputting a tile sends a command and the previews follow the new state', () => {
    const sent: unknown[] = [];
    window.llp = fakeLlpApi({
      live: {
        get: () => Promise.resolve(emptyLiveState()),
        send: command => void sent.push(command),
        subscribe: () => () => undefined,
      },
    });
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    const counts = drawCounts();
    act(() => outputTile({itemId: 'song-morning', index: 1}));
    expect(sent).toHaveLength(1);
    expect(drawCounts()).toEqual(counts);
    act(() =>
      setLayers(
        {
          slide: {
            itemId: 'song-morning',
            position: 1,
            label: '후렴',
            lines: [],
          },
        },
        allOn,
      ),
    );
    for (const instance of created()) {
      expect(instance.render.mock.lastCall?.[0]).toMatchObject({
        slide: {position: 1},
      });
    }
  });

  it('disposes every renderer when the panel unmounts', () => {
    setLayers({}, allOn);
    const {unmount} = render(<PreviewPanel compact={false} />);
    unmount();
    for (const instance of created()) {
      expect(instance.dispose).toHaveBeenCalledTimes(1);
    }
  });

  it('stops drawing after it unmounts', () => {
    setLayers({}, allOn);
    const {unmount} = render(<PreviewPanel compact={false} />);
    unmount();
    const before = drawCounts();
    act(() => setLayers({slide}, allOn));
    expect(drawCounts()).toEqual(before);
  });

  it('sends a drawing error to the main log', () => {
    const write = vi.fn();
    window.llp = fakeLlpApi({log: {write}});
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    created()[0]?.options.onError('could not draw', new Error('boom'));
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({level: 'error', message: 'could not draw'}),
    );
  });
});
