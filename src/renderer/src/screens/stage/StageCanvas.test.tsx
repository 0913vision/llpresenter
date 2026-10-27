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
import {emptyLiveState} from '@shared/live';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useLive} from '@renderer/state/live';
import {settingsDocument, LAYOUT_ID} from '../testing/documents';
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
  {properties = false}: {properties?: boolean} = {},
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
      for (const listener of listeners) listener(current);
      return {
        ok: true as const,
        value: {id: 'stage-layouts', revision: current.revision},
      };
    },
  );
  window.llp = fakeLlpApi({
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
  return {view, edit, frame, element, listeners};
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
      '[data-stage-element="first"]',
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
});
