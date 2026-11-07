import {
  BROADCAST_SCREEN,
  MAIN_SCREEN,
  STAGE_SCREEN,
} from '@fixtures/core/screenIds';
import {act, cleanup, fireEvent, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {emptyLayers, emptyLiveState, type LiveLayers} from '@core/live/state';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {setTilesHidden, showLarge, usePreview} from '@renderer/session/preview';
import {openItem, selectTile, useShow} from '@renderer/session/show';
import {
  PreviewHeaderPicker,
  PreviewPanel,
} from '@renderer/features/presentation/PreviewPanel';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
import {renderWithScreenSummaries as render} from '@fixtures/renderer/platform/screenSummaries';
import {ScreenSummariesContext} from '@renderer/platform/ScreenSummaries';
import type {ScreenSummary} from '@renderer/platform/screens';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {commandBindingStore} from '@renderer/ui/commandBindings';

interface Instance {
  readonly parent: HTMLElement;
  readonly options: {
    readonly textStyle: unknown;
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

vi.mock('@renderer/rendering/screenFrames', () => ({
  ScreenFrames: class {
    frame(state: unknown) {
      return state === null ? undefined : {};
    }
    dispose = vi.fn();
  },
}));

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

const allOn = {main: true, stage: true, broadcast: true};
const slide = {itemId: 'a', position: 0, label: null, lines: ['x']};

beforeEach(() => {
  instances.list.length = 0;
  usePreview.setState({largeScreenId: MAIN_SCREEN});
  seedSampleService();
  useShow.setState({openItemId: null, selectedTile: 0});
  useLive.setState({state: null});
  window.llp = mockLlpApi();
});

afterEach(() => {
  cleanup();
  commandBindingStore.set({});
  delete window.llp;
});

describe('PreviewPanel layout', () => {
  it('runs an assigned screen-preview shortcut through the same selection action without output', () => {
    const send = vi.fn();
    window.llp = mockLlpApi({live: {send}});
    const summaries: readonly ScreenSummary[] = [
      {
        id: STARTER_SCREEN_IDS.main,
        icon: 'mplay',
        toolbarLabel: '청중 화면',
        statusLabel: '청중 화면',
        target: '창',
        targetKind: 'window',
        chroma: false,
      },
      {
        id: STARTER_SCREEN_IDS.stage,
        icon: 'mplay',
        toolbarLabel: '무대',
        statusLabel: '무대 화면',
        target: '창',
        targetKind: 'window',
        chroma: false,
        kind: 'stage',
      },
    ];
    commandBindingStore.set({
      [`preview.focus.${STARTER_SCREEN_IDS.stage}`]: [
        {code: 'KeyP', mods: ['ctrl', 'alt']},
      ],
    });
    showLarge(STARTER_SCREEN_IDS.main);
    const {container} = render(
      <ScreenSummariesContext value={summaries}>
        <PreviewPanel compact={false} />
      </ScreenSummariesContext>,
    );
    fireEvent.keyDown(document.body, {
      code: 'KeyP',
      ctrlKey: true,
      altKey: true,
    });
    expect(usePreview.getState().largeScreenId).toBe(STARTER_SCREEN_IDS.stage);
    expect(screensWithRole(container, 'large')).toEqual([
      STARTER_SCREEN_IDS.stage,
    ]);
    fireEvent.click(screen.getByRole('button', {name: /청중 화면/}));
    expect(usePreview.getState().largeScreenId).toBe(STARTER_SCREEN_IDS.main);
    expect(send).not.toHaveBeenCalled();
  });

  it('falls back to the 청중 화면 when the large screen is unknown', () => {
    setLayers({}, allOn);
    showLarge('gone');
    const {container} = render(<PreviewPanel compact={false} />);
    expect(screensWithRole(container, 'large')).toEqual([MAIN_SCREEN]);
  });

  it.each([false, true])(
    'shows one big picture and tiles for the other screens only across every selection, compact=%s',
    compact => {
      const send = vi.fn();
      window.llp = mockLlpApi({live: {send}});
      setLayers({}, allOn);
      const {container} = render(<PreviewPanel compact={compact} />);
      const order = [MAIN_SCREEN, STAGE_SCREEN, BROADCAST_SCREEN];
      expect(screensWithRole(container, 'large')).toEqual([MAIN_SCREEN]);
      for (const id of [STAGE_SCREEN, BROADCAST_SCREEN, MAIN_SCREEN]) {
        const button = container.querySelector(`[data-preview-slot="${id}"]`);
        if (!button) throw new Error(`Missing tile: ${id}`);
        fireEvent.click(button);
        expect(
          screen
            .getAllByRole('button')
            .map(slot => slot.dataset['previewSlot']),
        ).toEqual(order.filter(other => other !== id));
        expect(screensWithRole(container, 'large')).toEqual([id]);
        expect(screensWithRole(container, 'small')).toEqual(
          order.filter(other => other !== id),
        );
        expect(
          container.querySelectorAll('[data-selected-marker]'),
        ).toHaveLength(0);
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
    fireEvent.click(screen.getByRole('button', {name: /방송 화면/}));
    expect(created()).toHaveLength(3);
    expect(created()).toEqual(before);
    for (const instance of created()) {
      expect(instance.dispose).not.toHaveBeenCalled();
    }
    expect(drawCounts()).toEqual(counts);
  });
});

describe('PreviewPanel states', () => {
  it('dims the name of a screen whose output is off and keeps drawing it', () => {
    setLayers({slide}, {main: false, stage: true, broadcast: true});
    const {container} = render(<PreviewPanel compact={false} />);
    const large = itemOf(container, MAIN_SCREEN);
    expect(large.getAttribute('data-state')).toBe('off');
    expect(screen.queryByRole('button', {pressed: true})).toBeNull();
    expect(created()[0]?.render).toHaveBeenLastCalledWith(
      expect.objectContaining({slide}),
      expect.anything(),
    );
  });

  it('treats a screen the live state does not know as off', () => {
    setLayers({}, {});
    const {container} = render(<PreviewPanel compact={false} />);
    expect(itemOf(container, MAIN_SCREEN).getAttribute('data-state')).toBe(
      'off',
    );
  });
});

describe('PreviewPanel pictures', () => {
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
        expect.anything(),
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
        expect.anything(),
      );
    }
    expect(created()).toHaveLength(3);
  });

  it('waits for the first complete frame before drawing', () => {
    render(<PreviewPanel compact={false} />);
    for (const instance of created()) {
      expect(instance.render).not.toHaveBeenCalled();
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
    window.llp = mockLlpApi({log: {write}});
    setLayers({}, allOn);
    render(<PreviewPanel compact={false} />);
    created()[0]?.options.onError('could not draw', new Error('boom'));
    expect(write).toHaveBeenCalledWith(
      expect.objectContaining({level: 'error', message: 'could not draw'}),
    );
  });
});

describe('PreviewPanel screen list changes', () => {
  function summary(id: string, name: string): ScreenSummary {
    return {
      id,
      icon: 'mplay',
      toolbarLabel: name,
      statusLabel: name,
      target: '창',
      targetKind: 'window',
      chroma: false,
    };
  }

  it.each([16, 50])(
    'keeps all %i screens reachable as tiles without replacing their pictures',
    count => {
      const screens = Array.from({length: count}, (_, index) =>
        summary(
          `60000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          `긴 검증용 화면 ${index + 1}`,
        ),
      );
      const view = render(
        <ScreenSummariesContext value={screens}>
          <PreviewPanel compact />
        </ScreenSummariesContext>,
      );
      const last = screens.at(-1);
      const first = screens[0];
      if (last === undefined || first === undefined) {
        throw new Error('Missing screen fixtures');
      }
      const pictures = [...view.container.querySelectorAll('[data-screen]')];
      expect(pictures).toHaveLength(count);
      expect(screen.getAllByRole('button')).toHaveLength(count - 1);

      for (let round = 0; round < 20; round++) {
        fireEvent.click(
          screen.getByRole('button', {
            name: `${last.toolbarLabel} 크게 보기, 출력 꺼짐`,
          }),
        );
        expect(screensWithRole(view.container, 'large')).toEqual([last.id]);
        fireEvent.click(
          screen.getByRole('button', {
            name: `${first.toolbarLabel} 크게 보기, 출력 꺼짐`,
          }),
        );
        expect(screensWithRole(view.container, 'large')).toEqual([first.id]);
      }

      expect([...view.container.querySelectorAll('[data-screen]')]).toEqual(
        pictures,
      );
    },
  );

  it('drops deleted screens and falls back from a deleted large preview', () => {
    const view = render(
      <ScreenSummariesContext
        value={[
          summary(MAIN_SCREEN, '사용자 화면'),
          summary(BROADCAST_SCREEN, '사용자 캡처'),
        ]}
      >
        <PreviewPanel compact={false} />
      </ScreenSummariesContext>,
    );
    fireEvent.click(
      screen.getByRole('button', {name: /사용자 캡처 크게 보기/}),
    );

    view.rerender(
      <ScreenSummariesContext value={[summary(MAIN_SCREEN, '남은 화면')]}>
        <PreviewPanel compact={false} />
      </ScreenSummariesContext>,
    );
    expect(screen.queryByRole('button', {name: /사용자 캡처/})).toBeNull();
    expect(screensWithRole(view.container, 'large')).toEqual([MAIN_SCREEN]);
    expect(screensWithRole(view.container, 'small')).toEqual([]);
    view.rerender(
      <ScreenSummariesContext value={[]}>
        <PreviewPanel compact={false} />
      </ScreenSummariesContext>,
    );

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(view.container.querySelectorAll('[data-screen]')).toHaveLength(0);
  });
});

describe('PreviewHeaderPicker', () => {
  it('offers nothing while the tile row shows, and a screen picker once it is hidden', () => {
    setLayers({}, allOn);
    const {container} = render(<PreviewHeaderPicker />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    act(() => setTilesHidden(true));
    const group = screen.getByRole('radiogroup', {name: '미리보기 화면'});
    expect(
      Array.from(group.querySelectorAll('[role="radio"]')).map(
        radio => radio.textContent,
      ),
    ).toEqual(['청중 화면', '무대 화면', '방송 화면']);
    fireEvent.click(screen.getByRole('radio', {name: '무대 화면'}));
    expect(usePreview.getState().largeScreenId).toBe(STAGE_SCREEN);
    act(() => setTilesHidden(false));
    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('is hidden again once the panel that hid the tiles unmounts', () => {
    setLayers({}, allOn);
    const view = render(<PreviewPanel compact={false} />);
    act(() => setTilesHidden(true));
    view.unmount();
    expect(usePreview.getState().tilesHidden).toBe(false);
  });
});
