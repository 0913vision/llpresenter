import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, emptyLiveState, type LiveLayers} from '@shared/live';
import {mediaUrl} from '@shared/media';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {useLive} from '@renderer/state/live';
import {showLarge, usePreview} from '@renderer/state/preview';
import {PreviewPanel} from './PreviewPanel';

interface Instance {
  readonly parent: HTMLElement;
  readonly options: {
    readonly lyricStyle: unknown;
    readonly mediaUrl: unknown;
    readonly onError: (message: string, error: unknown) => void;
  };
  readonly render: ReturnType<typeof vi.fn>;
  readonly dispose: ReturnType<typeof vi.fn>;
}

const instances = vi.hoisted(() => {
  const list: unknown[] = [];
  return {list};
});

vi.mock('@renderer/render/outputRenderer', () => ({
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

function setLayers(layers: Partial<LiveLayers>, on: Record<string, boolean>) {
  useLive.setState({
    state: {
      ...emptyLiveState(),
      layers: {...emptyLayers(), ...layers},
      outputs: on,
    },
  });
}

const allOn = {main: true, stage: true, broadcast: true};
const slide = {itemId: 'a', position: 0, label: null, lines: ['x']};

beforeEach(() => {
  instances.list.length = 0;
  usePreview.setState({largeScreenId: 'main'});
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
    expect(
      container.querySelector('[data-screen="main"]:not(button)'),
    ).not.toBeNull();
    const smalls = screen.getAllByRole('button');
    expect(smalls.map(button => button.getAttribute('data-screen'))).toEqual([
      'stage',
      'broadcast',
    ]);
  });

  it('makes a small preview large when it is clicked, and the large one small', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    fireEvent.click(screen.getByRole('button', {name: /무대 화면/}));
    expect(usePreview.getState().largeScreenId).toBe('stage');
    expect(
      container.querySelector('[data-screen="stage"]:not(button)'),
    ).not.toBeNull();
    expect(
      screen
        .getAllByRole('button')
        .map(button => button.getAttribute('data-screen')),
    ).toEqual(['main', 'broadcast']);
  });

  it('keeps the small ones in the fixed order whichever screen is large', () => {
    setLayers({}, allOn);
    showLarge('broadcast');
    render(<PreviewPanel compact={false} />);
    expect(
      screen
        .getAllByRole('button')
        .map(button => button.getAttribute('data-screen')),
    ).toEqual(['main', 'stage']);
  });

  it('does not make the large preview a button', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    const large = container.querySelector('[data-screen="main"]:not(button)');
    expect(large?.closest('button')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('writes the screen name, target, and look name under the large preview', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    expect(screen.getByText('본 화면')).toBeTruthy();
    expect(screen.getByText('모니터 2')).toBeTruthy();
    expect(screen.getByText('기본')).toBeTruthy();
  });

  it('writes only the name and target under a small preview, not the look name', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    expect(screen.getByText('NDI')).toBeTruthy();
    expect(screen.queryByText('하단 자막')).toBeNull();
  });

  it('uses rows for the small previews in the narrow window form', () => {
    setLayers({}, allOn);
    render(<PreviewPanel compact />);
    const small = screen.getAllByRole('button')[0];
    expect(small?.className).toContain('compact');
  });
});

describe('PreviewPanel states', () => {
  it('dims the name of a screen whose output is off and keeps drawing it', () => {
    setLayers({slide}, {main: false, stage: true, broadcast: true});
    const {container} = render(<PreviewPanel compact={false} />);
    const large = container.querySelector('[data-screen="main"]:not(button)');
    expect(large?.getAttribute('data-state')).toBe('off');
    expect(large?.getAttribute('title')).toBe('본 화면 출력이 꺼져 있습니다');
    const [first] = created();
    expect(first?.render).toHaveBeenLastCalledWith(
      expect.objectContaining({slide}),
    );
  });

  it('marks a small preview whose output is off', () => {
    setLayers({}, {main: true, stage: false, broadcast: true});
    render(<PreviewPanel compact={false} />);
    const stage = screen.getByRole('button', {name: /무대 화면/});
    expect(stage.getAttribute('data-state')).toBe('off');
    expect(stage.getAttribute('title')).toBe('무대 화면 출력이 꺼져 있습니다');
  });

  it('treats a screen the live state does not know as off', () => {
    setLayers({}, {});
    const {container} = render(<PreviewPanel compact={false} />);
    expect(
      container
        .querySelector('[data-screen="main"]:not(button)')
        ?.getAttribute('data-state'),
    ).toBe('off');
  });

  it('draws the 방송 자막 frame green', () => {
    setLayers({}, allOn);
    showLarge('broadcast');
    const {container} = render(<PreviewPanel compact={false} />);
    const frame = container.querySelector(
      '[data-screen="broadcast"]:not(button) [data-state], [data-screen="broadcast"]:not(button) > div',
    );
    expect(frame?.className).toContain('chroma');
  });

  it('does not make the other frames green', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewPanel compact={false} />);
    expect(container.querySelectorAll('[class*="chroma"]')).toHaveLength(1);
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

  it('does not follow the selection: another open item changes nothing in the pictures', () => {
    setLayers({slide}, allOn);
    render(<PreviewPanel compact={false} />);
    const callsBefore = created().map(instance => instance.render.mock.calls);
    act(() => showLarge('stage'));
    for (const [index, instance] of created().entries()) {
      expect(instance.render.mock.calls.length).toBeGreaterThanOrEqual(
        callsBefore[index]?.length ?? 0,
      );
      expect(instance.render).toHaveBeenLastCalledWith(
        expect.objectContaining({slide}),
      );
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
    const before = created().map(instance => instance.render.mock.calls.length);
    act(() => setLayers({slide}, allOn));
    expect(
      created().map(instance => instance.render.mock.calls.length),
    ).toEqual(before);
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
