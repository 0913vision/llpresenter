import {StrictMode, useLayoutEffect, useState} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {ElementFrame} from '@core/canvas/frameEdit';
import {
  CanvasEditor,
  type CanvasActions,
  type CanvasDocument,
  type CanvasElement,
} from './CanvasEditor';
import {mockCanvasViewport} from './canvasTesting';

beforeEach(mockCanvasViewport);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(
  access: 'editable' | 'readOnly' = 'editable',
  saving = Promise.resolve(),
  {
    fieldFrames = [],
    footer = 'frames',
    selectedIds = [],
    minimumSize = 20,
    contained = false,
  }: {
    fieldFrames?: readonly ElementFrame[];
    footer?: 'frames' | 'zoom';
    selectedIds?: readonly string[];
    minimumSize?: number;
    contained?: boolean;
  } = {},
) {
  let current: CanvasDocument<CanvasElement> = {
    width: 1920,
    height: 1080,
    minimumSize,
    contained,
    elements: [
      {id: 'first', name: '요소', frame: {x: 100, y: 100, w: 400, h: 200}},
    ],
  };
  let feed: (value: CanvasDocument<CanvasElement>) => void = () => undefined;
  const responses = [...fieldFrames];
  const mockEdit = vi.fn();
  const publishFrame = (frame: ElementFrame): void => {
    current = {
      ...current,
      elements: current.elements.map(element =>
        element.id === 'first' ? {...element, frame} : element,
      ),
    };
    feed(current);
  };
  const mockActions = {
    frame: vi.fn<CanvasActions['frame']>((id, frame, completed) => {
      mockEdit(id, frame);
      saving.then(
        () => {
          publishFrame(frame);
          completed(true);
        },
        () => completed(false),
      );
    }),
    frameValue: vi.fn<CanvasActions['frameValue']>((id, change, completed) => {
      mockEdit(id, change);
      const frame = responses.shift();
      if (frame === undefined) {
        throw new Error('Unexpected numeric frame request');
      }
      saving.then(
        () => {
          publishFrame(frame);
          completed(frame);
        },
        () => completed(null),
      );
    }),
    nudge: vi.fn<CanvasActions['nudge']>((id, delta) => {
      mockEdit(id, delta);
    }),
    remove: vi.fn<CanvasActions['remove']>(id => {
      mockEdit(id);
    }),
  };
  function Harness() {
    const [value, setValue] = useState(current);
    const [selected, setSelected] = useState<string | null>(null);
    const [keepRatio, setKeepRatio] = useState(false);
    const [snapGrid, setSnapGrid] = useState(false);
    useLayoutEffect(() => {
      feed = setValue;
      return () => {
        feed = () => undefined;
      };
    }, []);
    return (
      <CanvasEditor
        value={value}
        label="테스트"
        selected={selected}
        selectedIds={selectedIds}
        footer={footer}
        onSelect={setSelected}
        readOnlyReason={access === 'readOnly' ? '읽기 전용' : undefined}
        actions={mockActions}
        keepRatio={keepRatio}
        setKeepRatio={setKeepRatio}
        snapGrid={snapGrid}
        setSnapGrid={setSnapGrid}
        getElementLabel={element => element.name}
        renderContent={() => null}
      />
    );
  }
  const view = render(
    <StrictMode>
      <Harness />
    </StrictMode>,
  );
  return {
    view,
    edit: mockEdit,
    frame: () => current.elements[0]?.frame,
    mockActions,
    publishFrame,
  };
}

it('offers bounded zoom controls with fit reset and externally selected frames', () => {
  setup('editable', Promise.resolve(), {
    footer: 'zoom',
    selectedIds: ['first'],
  });
  expect(
    screen.getByRole('button', {name: '요소'}).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryByRole('spinbutton', {name: 'X'})).toBeNull();
  const initial = screen.getByLabelText('캔버스 배율').textContent;
  fireEvent.click(screen.getByRole('button', {name: '확대'}));
  expect(screen.getByLabelText('캔버스 배율').textContent).not.toBe(initial);
  fireEvent.click(screen.getByRole('button', {name: '화면에 맞춤'}));
  expect(screen.getByLabelText('캔버스 배율').textContent).toBe(initial);
  for (let index = 0; index < 10; index++) {
    fireEvent.click(screen.getByRole('button', {name: '축소'}));
  }
  expect(
    screen.getByRole('button', {name: '축소'}).getAttribute('aria-disabled'),
  ).toBe('true');
});

it('keeps a completed drag drawn through Tab and unrelated keys while its save is held', async () => {
  let release: () => void = () => undefined;
  const saving = new Promise<void>(resolve => {
    release = resolve;
  });
  const {edit, frame} = setup('editable', saving);
  const item = await screen.findByRole('button', {name: '요소'});
  const canvas = screen.getByLabelText('테스트 캔버스');
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

it('stores a dragged frame at the precision shown by the shared geometry fields', async () => {
  const {frame} = setup();
  const item = await screen.findByRole('button', {name: '요소'});
  const canvas = screen.getByLabelText('테스트 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 1,
    clientX: 110.126,
    clientY: 120.227,
    altKey: true,
  });
  expect(screen.getByRole('spinbutton', {name: 'X'})).toHaveProperty(
    'value',
    '120.3',
  );
  expect(screen.getByRole('spinbutton', {name: 'Y'})).toHaveProperty(
    'value',
    '140.5',
  );
  fireEvent.pointerUp(canvas, {pointerId: 1});
  await waitFor(() =>
    expect(frame()).toEqual({x: 120.3, y: 140.5, w: 400, h: 200}),
  );
});

it('keeps rounded geometry inside a contained canvas at a fractional edge', async () => {
  const {frame, publishFrame} = setup('editable', Promise.resolve(), {
    contained: true,
  });
  act(() => publishFrame({x: 115.25, y: 100, w: 1804.75, h: 200}));
  const item = await screen.findByRole('button', {name: '요소'});
  const canvas = screen.getByLabelText('테스트 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 1,
    clientX: 110.126,
    clientY: 100,
    altKey: true,
  });
  fireEvent.pointerUp(canvas, {pointerId: 1});
  await waitFor(() =>
    expect(frame()).toEqual({x: 115.2, y: 100, w: 1804.8, h: 200}),
  );
});

it('selects an element without writing unchanged geometry on a pointer click', async () => {
  const {edit} = setup();
  const item = await screen.findByRole('button', {name: '요소'});
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

it.each([false, true])(
  'draws token-distance guides, responds to Alt, and clears decoration before saving (contained=%s)',
  async contained => {
    const {edit, frame} = setup('editable', Promise.resolve(), {contained});
    const item = await screen.findByRole('button', {name: '요소'});
    const canvas = screen.getByLabelText('테스트 캔버스');
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
    expect(guides()[0]?.parentElement?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    fireEvent.keyDown(item, {key: 'Alt', altKey: true});
    expect(guides()).toHaveLength(0);
    expect(
      document.querySelector<HTMLElement>('[data-canvas-element="first"]')
        ?.style.left,
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
    await waitFor(() =>
      expect(frame()).toEqual({x: 0, y: 100, w: 400, h: 200}),
    );
  },
);

it('excludes the manipulated element and discards guides on cancellation and unmount', async () => {
  const {edit, view} = setup();
  const item = await screen.findByRole('button', {name: '요소'});
  const canvas = screen.getByLabelText('테스트 캔버스');
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
  expect(edit).not.toHaveBeenCalled();
});

it('edits bounded reference-pixel fields and cancels invalid or escaped drafts', async () => {
  const {edit, frame, mockActions} = setup('editable', Promise.resolve(), {
    fieldFrames: [
      {x: 160, y: 100, w: 400, h: 200},
      {x: 160, y: 210, w: 400, h: 200},
      {x: 160, y: 210, w: 500, h: 200},
      {x: 160, y: 210, w: 500, h: 260},
      {x: 0, y: 210, w: 500, h: 260},
      {x: 0, y: 210, w: 1920, h: 260},
    ],
  });
  const item = await screen.findByRole('button', {name: '요소'});
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
  expect(
    mockActions.frameValue.mock.calls.map(([, change]) => [
      change.field,
      change.value,
    ]),
  ).toEqual([
    ['x', 160],
    ['y', 210],
    ['w', 500],
    ['h', 260],
    ['x', 0],
    ['w', 1920],
  ]);
  expect(screen.getByLabelText('캔버스 배율').textContent).toBe('50%');
});

it('toggles ratio without saving and couples both numeric and pointer resizing', async () => {
  const {edit, frame, mockActions} = setup('editable', Promise.resolve(), {
    fieldFrames: [
      {x: 100, y: 100, w: 600, h: 300},
      {x: 100, y: 100, w: 640, h: 400},
    ],
  });
  fireEvent.click(await screen.findByRole('button', {name: '요소'}));
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
  expect(mockActions.frameValue).toHaveBeenLastCalledWith(
    'first',
    {field: 'w', value: 600, keepRatio: true},
    expect.any(Function),
  );
  const handle = screen.getByRole('button', {
    name: '요소 오른쪽 아래 크기 조절',
  });
  fireEvent.pointerDown(handle, {
    button: 0,
    pointerId: 2,
    clientX: 0,
    clientY: 0,
  });
  const canvas = screen.getByLabelText('테스트 캔버스');
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
  expect(mockActions.frameValue).toHaveBeenLastCalledWith(
    'first',
    {field: 'h', value: 400, keepRatio: false},
    expect.any(Function),
  );
});

it('snaps scaled pointer moves while leaving numeric values and arrows precise', async () => {
  const {edit, frame, mockActions, publishFrame} = setup(
    'editable',
    Promise.resolve(),
    {fieldFrames: [{x: 133, y: 130, w: 400, h: 200}]},
  );
  const item = await screen.findByRole('button', {name: '요소'});
  const grid = screen.getByRole('button', {name: '격자에 맞추기'});
  expect(grid.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(grid);
  expect(edit).not.toHaveBeenCalled();
  const canvas = screen.getByLabelText('테스트 캔버스');
  fireEvent.pointerDown(item, {
    button: 0,
    pointerId: 5,
    clientX: 0,
    clientY: 0,
  });
  fireEvent.pointerMove(canvas, {pointerId: 5, clientX: 13, clientY: 7});
  fireEvent.pointerUp(canvas, {pointerId: 5});
  await waitFor(() => expect(frame()).toMatchObject({x: 120, y: 120}));
  fireEvent.keyDown(canvas, {key: 'ArrowRight', code: 'ArrowRight'});
  fireEvent.keyDown(canvas, {
    key: 'ArrowDown',
    code: 'ArrowDown',
    shiftKey: true,
  });
  expect(mockActions.nudge.mock.calls).toEqual([
    ['first', {x: 1, y: 0}],
    ['first', {x: 0, y: 10}],
  ]);
  act(() => publishFrame({x: 121, y: 130, w: 400, h: 200}));
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
  fireEvent.click(await screen.findByRole('button', {name: '요소'}));
  fireEvent.click(screen.getByRole('button', {name: '격자에 맞추기'}));
  fireEvent.click(screen.getByRole('button', {name: '비율 고정'}));
  const handle = screen.getByRole('button', {
    name: '요소 오른쪽 아래 크기 조절',
  });
  const canvas = screen.getByLabelText('테스트 캔버스');
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
    name: '요소',
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
  fireEvent.click(await screen.findByRole('button', {name: '요소'}));
  expect(
    screen.getByRole('button', {name: '요소'}).getAttribute('aria-pressed'),
  ).toBe('true');
  expect(screen.queryAllByRole('button', {name: /크기 조절/})).toHaveLength(0);
  fireEvent.keyDown(screen.getByLabelText('테스트 캔버스'), {
    key: 'Delete',
    code: 'Delete',
  });
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
