import {settingsDocument} from '@core/testing/settingsDocument';
import {StrictMode} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import {mockLlpApi} from '@contracts/ipc/testing/mockLlpApi';
import {useLive} from '@renderer/session/live';
import {LAYOUT_ID} from '@core/testing/screenDocuments';
import {useScreensSelection} from '../selection';
import {StageCanvas} from './StageCanvas';
import {StageProperties} from './StageProperties';

beforeEach(() => {
  vi.stubGlobal(
    'PointerEvent',
    class extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init: PointerEventInit) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
      }
    },
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback(
          [
            {
              target: document.createElement('div'),
              contentRect: new DOMRect(0, 0, 960, 540),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: [],
            },
          ],
          this,
        );
      }
      unobserve() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 960, 540),
  );
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLElement.prototype.hasPointerCapture = () => false;
  useLive.setState({state: emptyLiveState()});
  useScreensSelection.getState().select('stage', LAYOUT_ID);
  useScreensSelection.getState().selectStageElement(LAYOUT_ID, null);
});
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(
  access: 'editable' | 'readOnly' = 'editable',
  saving: Promise<void> = Promise.resolve(),
  {
    properties = false,
    delayedFeed = false,
  }: {
    properties?: boolean;
    delayedFeed?: boolean;
  } = {},
) {
  let current = settingsDocument('stage-layouts', {
    format: 'llsettings.stage',
    layouts: [
      {
        id: LAYOUT_ID,
        name: 'Canvas',
        width: 1920,
        height: 1080,
        elements: [
          {
            id: 'first',
            name: '현재 가사',
            kind: 'currentSlide',
            frame: {x: 100, y: 100, w: 400, h: 200},
          },
        ],
      },
    ],
  });
  const listeners = new Set<(value: SettingsDocument) => void>();
  const edit = vi.fn(
    async (
      change: Parameters<NonNullable<Window['llp']>['settings']['edit']>[0],
    ) => {
      if (
        change.type !== 'settings.update' ||
        change.name !== 'stage-layouts'
      ) {
        throw new Error('Unexpected edit');
      }
      await saving;
      current = settingsDocument(
        'stage-layouts',
        change.value,
        current.revision + 1,
      );
      if (!delayedFeed) {
        for (const listener of listeners) listener(current);
      }
      return {
        ok: true as const,
        value: {id: 'stage-layouts', revision: current.revision},
      };
    },
  );
  window.llp = mockLlpApi({
    settings: {
      get: request =>
        Promise.resolve(
          request.name === 'stage-layouts'
            ? {...current, access}
            : settingsDocument('timers', {timers: []}),
        ),
      edit,
      subscribe: callback => {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
    },
  });
  const view = render(
    <StrictMode>
      <StageCanvas />
      {properties ? <StageProperties /> : null}
    </StrictMode>,
  );
  const element = () =>
    current.name === 'stage-layouts'
      ? current.value.layouts[0]?.elements[0]
      : undefined;
  const frame = () => element()?.frame;
  const publish = () => {
    for (const listener of listeners) listener(current);
  };
  return {view, edit, frame, element, listeners, publish};
}

it('selects, previews a scaled drag, saves once, nudges cumulatively, and deletes', async () => {
  const {edit, frame, view, listeners} = setup();
  const item = await screen.findByRole('button', {
    name: '현재 가사',
  });
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.lostPointerCapture(item, {pointerId: 1, buttons: 1});
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 110, clientY: 120});
  expect(edit).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', {name: /크기 조절/})).toHaveLength(8);
  fireEvent.pointerUp(canvas, {pointerId: 1});
  await waitFor(() => expect(frame()).toMatchObject({x: 120, y: 140}));
  expect(edit).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(item, {key: 'ArrowRight'});
  fireEvent.keyDown(item, {key: 'ArrowDown', shiftKey: true});
  await waitFor(() => expect(frame()).toMatchObject({x: 121, y: 150}));
  const handle = screen.getByRole('button', {
    name: '현재 가사 오른쪽 아래 크기 조절',
  });
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId: 2,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.lostPointerCapture(item, {pointerId: 2});
  fireEvent.pointerMove(canvas, {pointerId: 2, clientX: 20, clientY: 10});
  fireEvent.pointerUp(canvas, {pointerId: 2});
  await waitFor(() => expect(frame()).toMatchObject({w: 440, h: 220}));
  fireEvent.keyDown(item, {key: 'Delete'});
  await waitFor(() => expect(frame()).toBeUndefined());
  view.unmount();
  expect(listeners.size).toBe(0);
});

it('keeps a completed drag drawn through Tab and unrelated keys while its save is held', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {edit, frame} = setup('editable', saving);
  const item = await screen.findByRole('button', {name: '현재 가사'});
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 110, clientY: 120});
  fireEvent.pointerUp(canvas, {pointerId: 1});
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  for (const key of ['Tab', 'Shift', 'a']) {
    fireEvent.keyDown(canvas, {key});
    const element = document.querySelector<HTMLElement>(
      '[data-canvas-element="first"]',
    );
    expect(Number.parseFloat(element?.style.left ?? '')).toBeCloseTo(
      (100 * 120) / 1920,
    );
    expect(frame()).toMatchObject({x: 100, y: 100});
  }
  release();
  await waitFor(() => expect(frame()).toMatchObject({x: 120, y: 140}));
});

it('selects an element without writing unchanged geometry on a pointer click', async () => {
  const {edit} = setup();
  const item = await screen.findByRole('button', {name: '현재 가사'});
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerUp(item, {pointerId: 1});
  await act(() => Promise.resolve());
  expect(item.getAttribute('aria-pressed')).toBe('true');
  expect(edit).not.toHaveBeenCalled();
});

it('draws token-distance guides, responds to Alt without pointer movement, and removes decoration before saving', async () => {
  const {edit, frame} = setup();
  const item = await screen.findByRole('button', {name: '현재 가사'});
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  canvas.style.setProperty('--size-guide-snap', '6px');
  const guides = () => document.querySelectorAll('[data-canvas-guide]');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 51, clientY: 100});
  expect(guides()).toHaveLength(1);
  expect(guides()[0]?.parentElement?.getAttribute('aria-hidden')).toBe('true');
  fireEvent.keyDown(item, {key: 'Alt', altKey: true});
  expect(guides()).toHaveLength(0);
  expect(
    document.querySelector<HTMLElement>('[data-canvas-element="first"]')?.style
      .left,
  ).toBe(`${(100 * 2) / 1920}%`);
  fireEvent.keyUp(item, {key: 'Alt'});
  expect(guides()).toHaveLength(1);
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 56.5, clientY: 100});
  expect(guides()).toHaveLength(0);
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 56, clientY: 100});
  expect(guides()).toHaveLength(1);
  expect(edit).not.toHaveBeenCalled();
  fireEvent.pointerUp(canvas, {pointerId: 1});
  expect(guides()).toHaveLength(0);
  await waitFor(() => expect(frame()).toEqual({x: 0, y: 100, w: 400, h: 200}));
});

it('excludes the manipulated element and discards guides on cancellation and unmount', async () => {
  const {edit, view, listeners} = setup();
  const item = await screen.findByRole('button', {name: '현재 가사'});
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  canvas.style.setProperty('--size-guide-snap', '6px');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 102, clientY: 100});
  expect(document.querySelectorAll('[data-canvas-guide]')).toHaveLength(0);
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 51, clientY: 100});
  expect(document.querySelectorAll('[data-canvas-guide]')).toHaveLength(1);
  fireEvent.keyDown(item, {key: 'Escape'});
  expect(document.querySelectorAll('[data-canvas-guide]')).toHaveLength(0);
  fireEvent.pointerUp(canvas, {pointerId: 1});
  expect(edit).not.toHaveBeenCalled();
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 2,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {pointerId: 2, clientX: 51, clientY: 100});
  view.unmount();
  expect(document.querySelectorAll('[data-canvas-guide]')).toHaveLength(0);
  expect(listeners.size).toBe(0);
  expect(edit).not.toHaveBeenCalled();
});

it.each([
  {
    label: '이름',
    role: 'textbox',
    value: 'Renamed',
    expected: {name: 'Renamed'},
  },
  {
    label: '글자색',
    role: 'textbox',
    value: '#00FF00',
    expected: {text: {color: '#00FF00'}},
  },
  {
    label: '크기',
    role: 'spinbutton',
    value: '96',
    expected: {text: {size: 96}},
  },
])(
  'commits $label before a blank-canvas pointer sequence clears selection',
  async ({label, role, value, expected}) => {
    const {element} = setup('editable', Promise.resolve(), {properties: true});
    fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
    const input = await screen.findByRole(role, {name: label});
    input.focus();
    fireEvent.change(input, {target: {value}});
    const canvas = screen.getByLabelText('무대 배치 캔버스');
    fireEvent.pointerDown(canvas, {button: 0, pointerId: 1});
    fireEvent.mouseDown(canvas);
    fireEvent.pointerUp(canvas, {pointerId: 1});
    fireEvent.mouseUp(canvas);
    fireEvent.click(canvas);
    expect(useScreensSelection.getState().stageElement).toBeNull();
    await waitFor(() => expect(element()).toMatchObject(expected));
  },
);
it('edits bounded reference-pixel fields and cancels invalid or escaped drafts', async () => {
  const {edit, frame} = setup();
  const item = await screen.findByRole('button', {name: '현재 가사'});
  expect(
    screen.getByRole('spinbutton', {name: 'X'}).hasAttribute('readonly'),
  ).toBe(true);
  fireEvent.click(item);
  const enter = (name: string, value: string) => {
    const input = screen.getByRole('spinbutton', {name});
    fireEvent.change(input, {target: {value}});
    fireEvent.keyDown(input, {key: 'Enter'});
  };
  enter('X', '160');
  enter('Y', '210');
  enter('W', '500');
  enter('H', '260');
  await waitFor(() =>
    expect(frame()).toMatchObject({x: 160, y: 210, w: 500, h: 260}),
  );
  const x = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(x, {target: {value: '400'}});
  fireEvent.keyDown(x, {key: 'Escape'});
  fireEvent.blur(x);
  enter('X', 'invalid');
  expect(edit).toHaveBeenCalledTimes(4);
  expect(frame()?.x).toBe(160);
  enter('X', '-25');
  enter('W', '9999');
  await waitFor(() => expect(frame()).toMatchObject({x: 0, w: 1920}));
  expect(screen.getByLabelText('캔버스 배율').textContent).toBe('50%');
});

it('keeps a held drag and subsequent numeric fields drawn until their queued saves arrive', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {edit, frame} = setup('editable', saving);
  const item = await screen.findByRole('button', {name: '현재 가사'});
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 110, clientY: 120});
  fireEvent.pointerUp(canvas, {pointerId: 1});
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  for (const [name, value] of [
    ['X', '160'],
    ['Y', '210'],
  ] as const) {
    const input = screen.getByRole('spinbutton', {name});
    fireEvent.change(input, {target: {value}});
    fireEvent.keyDown(input, {key: 'Enter'});
  }
  const element = document.querySelector<HTMLElement>(
    '[data-canvas-element="first"]',
  );
  expect(Number.parseFloat(element?.style.left ?? '')).toBeCloseTo(
    (100 * 160) / 1920,
  );
  expect(Number.parseFloat(element?.style.top ?? '')).toBeCloseTo(
    (100 * 210) / 1080,
  );
  expect(frame()).toMatchObject({x: 100, y: 100});
  release();
  await waitFor(() =>
    expect(frame()).toMatchObject({x: 160, y: 210, w: 400, h: 200}),
  );
  expect(edit).toHaveBeenCalledTimes(3);
  expect(
    screen.getByRole('spinbutton', {name: 'X'}).getAttribute('value'),
  ).toBe('160');
});

it('keeps the other pending axes when a numeric edit returns one coordinate to its original value', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {edit, frame, publish} = setup('editable', saving, {delayedFeed: true});
  const item = await screen.findByRole('button', {name: '현재 가사'});
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {pointerId: 1, clientX: 110, clientY: 120});
  fireEvent.pointerUp(canvas, {pointerId: 1});
  await waitFor(() => expect(edit).toHaveBeenCalledTimes(1));
  const x = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(x, {target: {value: '100'}});
  fireEvent.keyDown(x, {key: 'Enter'});
  const element = document.querySelector<HTMLElement>(
    '[data-canvas-element="first"]',
  );
  expect(Number.parseFloat(element?.style.top ?? '')).toBeCloseTo(
    (100 * 140) / 1080,
  );
  expect(frame()).toMatchObject({x: 100, y: 100});
  release();
  await waitFor(() => expect(frame()).toMatchObject({x: 100, y: 140}));
  expect(Number.parseFloat(element?.style.top ?? '')).toBeCloseTo(
    (100 * 140) / 1080,
  );
  act(publish);
  await waitFor(() =>
    expect(
      screen.getByRole('spinbutton', {name: 'Y'}).getAttribute('value'),
    ).toBe('140'),
  );
});

it('toggles ratio without saving and couples both numeric and pointer resizing', async () => {
  const {edit, frame} = setup();
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  const ratio = screen.getByRole('button', {name: '비율 고정'});
  expect(ratio.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(ratio);
  expect(edit).not.toHaveBeenCalled();
  const width = screen.getByRole('spinbutton', {name: 'W'});
  fireEvent.change(width, {target: {value: '600'}});
  fireEvent.keyDown(width, {key: 'Enter'});
  await waitFor(() =>
    expect(frame()).toMatchObject({x: 100, y: 100, w: 600, h: 300}),
  );
  const handle = screen.getByRole('button', {
    name: '현재 가사 오른쪽 아래 크기 조절',
  });
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId: 2,
    clientX: 0,
    clientY: 0,
  });
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerMove(canvas, {pointerId: 2, clientX: 20, clientY: 10});
  fireEvent.pointerUp(canvas, {pointerId: 2});
  await waitFor(() =>
    expect(frame()).toMatchObject({x: 100, y: 100, w: 640, h: 320}),
  );
  fireEvent.click(ratio);
  const height = screen.getByRole('spinbutton', {name: 'H'});
  fireEvent.change(height, {target: {value: '400'}});
  fireEvent.keyDown(height, {key: 'Enter'});
  await waitFor(() => expect(frame()).toMatchObject({w: 640, h: 400}));
});

it('snaps scaled pointer moves while leaving numeric values and arrows precise', async () => {
  const {edit, frame} = setup();
  const item = await screen.findByRole('button', {name: '현재 가사'});
  const grid = screen.getByRole('button', {name: '격자에 맞추기'});
  expect(grid.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(grid);
  expect(edit).not.toHaveBeenCalled();
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 5,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(canvas, {pointerId: 5, clientX: 13, clientY: 7});
  fireEvent.pointerUp(canvas, {pointerId: 5});
  await waitFor(() => expect(frame()).toMatchObject({x: 120, y: 120}));
  fireEvent.keyDown(canvas, {key: 'ArrowRight'});
  fireEvent.keyDown(canvas, {key: 'ArrowDown', shiftKey: true});
  await waitFor(() => expect(frame()).toMatchObject({x: 121, y: 130}));
  const x = screen.getByRole('spinbutton', {name: 'X'});
  fireEvent.change(x, {target: {value: '133'}});
  fireEvent.keyDown(x, {key: 'Enter'});
  await waitFor(() => expect(frame()).toMatchObject({x: 133, y: 130}));
  fireEvent.click(grid);
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 6,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(canvas, {pointerId: 6, clientX: 4, clientY: 6});
  fireEvent.pointerUp(canvas, {pointerId: 6});
  await waitFor(() => expect(frame()).toMatchObject({x: 141, y: 142}));
});

it('combines grid and ratio using the moving corner axis and cancels a snapped draft', async () => {
  const {frame, edit} = setup();
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  fireEvent.click(screen.getByRole('button', {name: '격자에 맞추기'}));
  fireEvent.click(screen.getByRole('button', {name: '비율 고정'}));
  const handle = screen.getByRole('button', {
    name: '현재 가사 오른쪽 아래 크기 조절',
  });
  const canvas = screen.getByLabelText('무대 배치 캔버스');
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId: 7,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(canvas, {pointerId: 7, clientX: 15.5, clientY: 0.5});
  fireEvent.pointerUp(canvas, {pointerId: 7});
  await waitFor(() =>
    expect(frame()).toMatchObject({x: 100, y: 100, w: 440, h: 220}),
  );
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId: 8,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(canvas, {pointerId: 8, clientX: 27, clientY: 27});
  fireEvent.keyDown(canvas, {key: 'Escape'});
  fireEvent.pointerUp(canvas, {pointerId: 8});
  await act(() => Promise.resolve());
  expect(edit).toHaveBeenCalledTimes(1);
  expect(frame()).toMatchObject({w: 440, h: 220});
});

it('cancels a draft on Escape and keeps read-only elements selectable', async () => {
  const editable = setup();
  const item = await screen.findByRole('button', {
    name: '현재 가사',
  });
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(item, {pointerId: 1, clientX: 30, clientY: 30});
  fireEvent.keyDown(item, {key: 'Escape'});
  fireEvent.pointerUp(item, {pointerId: 1});
  await act(() => Promise.resolve());
  expect(editable.edit).not.toHaveBeenCalled();
  editable.view.unmount();
  const readOnly = setup('readOnly');
  fireEvent.click(await screen.findByRole('button', {name: '현재 가사'}));
  expect(
    screen
      .getByRole('button', {name: '현재 가사'})
      .getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryAllByRole('button', {name: /크기 조절/})).toHaveLength(0);
  fireEvent.keyDown(screen.getByLabelText('무대 배치 캔버스'), {key: 'Delete'});
  expect(readOnly.edit).not.toHaveBeenCalled();
  const grid = screen.getByRole('button', {name: '격자에 맞추기'});
  expect(grid.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(grid);
  expect(grid.getAttribute('aria-pressed')).toBe('false');
  expect(
    screen.getByRole('spinbutton', {name: 'W'}).hasAttribute('readonly'),
  ).toBe(true);
  fireEvent.keyDown(screen.getByRole('spinbutton', {name: 'X'}), {
    key: 'ArrowUp',
  });
  expect(readOnly.edit).not.toHaveBeenCalled();
});
