import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {looksSchema} from '@core/schema/looks';
import {DEFAULT_MESSAGE_STYLE} from '@core/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {looksDocument} from '../testing/documents';
import {LyricStyles} from './LyricStyles';
import type {LyricStyleEdit} from '@core/looks/lyricStyleEdits';

const drawing = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    constructor() {
      drawing.create();
    }
    render = drawing.render;
    dispose = drawing.dispose;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup(reason?: string) {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Wrong fixture');
  const looks = v.parse(looksSchema, {
    ...document.value,
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000301',
        name: '기본',
      },
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000302',
        name: '하단',
        size: 70,
      },
    ],
  });
  const change =
    vi.fn<(edit: LyricStyleEdit) => Promise<boolean> | undefined>();
  const effects = vi.fn();
  const view = render(
    <LyricStyles
      onEffectsChange={effects}
      looks={looks}
      reason={reason}
      onChange={change}
      onListChange={() => undefined}
      onProblem={vi.fn()}
    />,
  );
  return {...view, change, effects, looks};
}

it('previews on mount and switches presets without writing or recreating the renderer', () => {
  const view = setup();
  expect(drawing.render.mock.lastCall?.[1]).toHaveProperty(
    'look.lyricStyle.size',
    84,
  );
  fireEvent.click(screen.getByRole('tab', {name: '하단'}));
  expect(screen.getByLabelText('크기')).toHaveProperty('value', '70');
  expect(view.change).not.toHaveBeenCalled();
  expect(drawing.create).toHaveBeenCalledOnce();
  view.unmount();
  expect(drawing.dispose).toHaveBeenCalledOnce();
});

it('applies the picker color to the shared style and redraws its preview', () => {
  const view = setup();
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  const dialog = screen.getByRole('dialog', {name: '글자색 선택'});
  fireEvent.change(within(dialog).getByRole('slider', {name: '채도'}), {
    target: {value: '100'},
  });
  expect(view.change).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', {name: '적용'}));
  expect(view.change).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({change: {color: '#FF0000'}}),
  );
  view.rerender(
    <LyricStyles
      onEffectsChange={vi.fn()}
      looks={{
        ...view.looks,
        lyricStyles: view.looks.lyricStyles.map((style, index) =>
          index === 0 ? {...style, color: '#FF0000'} : style,
        ),
      }}
      reason={undefined}
      onChange={view.change}
      onListChange={() => undefined}
      onProblem={vi.fn()}
    />,
  );
  expect(drawing.render.mock.lastCall?.[1]).toHaveProperty(
    'look.lyricStyle.color',
    '#FF0000',
  );
});

it('preserves a queued color reversion and restores the last saved color on failure', async () => {
  const view = setup();
  let finishFirst: (success: boolean) => void = () => undefined;
  let finishSecond: (success: boolean) => void = () => undefined;
  const first = new Promise<boolean>(resolve => {
    finishFirst = resolve;
  });
  const second = new Promise<boolean>(resolve => {
    finishSecond = resolve;
  });
  const save = vi
    .fn<(edit: LyricStyleEdit) => Promise<boolean>>()
    .mockReturnValueOnce(first)
    .mockReturnValueOnce(second);
  const renderWith = (color: string) => (
    <LyricStyles
      onEffectsChange={vi.fn()}
      looks={{
        ...view.looks,
        lyricStyles: view.looks.lyricStyles.map((style, index) =>
          index === 0 ? {...style, color} : style,
        ),
      }}
      reason={undefined}
      onChange={save}
      onListChange={() => undefined}
      onProblem={vi.fn()}
    />
  );
  view.rerender(renderWith('#FFFFFF'));
  const field = screen.getByLabelText('글자색');
  fireEvent.change(field, {target: {value: '#112233'}});
  fireEvent.blur(field);
  expect(field).toHaveProperty('value', '#112233');
  fireEvent.click(screen.getByRole('button', {name: '글자색 선택'}));
  expect(
    within(screen.getByRole('dialog', {name: '글자색 선택'})).getByLabelText(
      '선택한 색',
    ).textContent,
  ).toBe('#112233');
  fireEvent.click(screen.getByRole('button', {name: '취소'}));
  fireEvent.change(field, {target: {value: '#FFFFFF'}});
  fireEvent.blur(field);
  expect(save.mock.calls.map(call => call[0].change)).toEqual([
    {color: '#112233'},
    {color: '#FFFFFF'},
  ]);
  view.rerender(renderWith('#112233'));
  expect(field).toHaveProperty('value', '#FFFFFF');
  await act(async () => {
    finishFirst(true);
  });
  await act(async () => {
    finishSecond(false);
  });
  expect(field).toHaveProperty('value', '#112233');
});

it('clears a successful no-op reversion after an earlier color save is refused', async () => {
  const view = setup();
  let finishFirst: (success: boolean) => void = () => undefined;
  let finishSecond: (success: boolean) => void = () => undefined;
  const first = new Promise<boolean>(resolve => {
    finishFirst = resolve;
  });
  const second = new Promise<boolean>(resolve => {
    finishSecond = resolve;
  });
  const save = vi
    .fn<(edit: LyricStyleEdit) => Promise<boolean>>()
    .mockReturnValueOnce(first)
    .mockReturnValueOnce(second)
    .mockResolvedValue(true);
  const renderWith = (color: string) => (
    <LyricStyles
      onEffectsChange={vi.fn()}
      looks={{
        ...view.looks,
        lyricStyles: view.looks.lyricStyles.map((style, index) =>
          index === 0 ? {...style, color} : style,
        ),
      }}
      reason={undefined}
      onChange={save}
      onListChange={() => undefined}
      onProblem={vi.fn()}
    />
  );
  view.rerender(renderWith('#FFFFFF'));
  const field = screen.getByLabelText('글자색');
  fireEvent.change(field, {target: {value: '#112233'}});
  fireEvent.blur(field);
  fireEvent.change(field, {target: {value: '#FFFFFF'}});
  fireEvent.blur(field);
  await act(async () => {
    finishFirst(false);
    finishSecond(true);
  });
  view.rerender(renderWith('#445566'));
  expect(field).toHaveProperty('value', '#445566');
  fireEvent.change(field, {target: {value: '#FFFFFF'}});
  fireEvent.blur(field);
  expect(save.mock.calls.map(call => call[0].change)).toEqual([
    {color: '#112233'},
    {color: '#FFFFFF'},
    {color: '#FFFFFF'},
  ]);
});

it('commits valid drafts, rejects invalid colors and cancels with Escape', () => {
  const {change} = setup();
  const size = screen.getByLabelText('크기');
  fireEvent.change(size, {target: {value: '96'}});
  expect(change).not.toHaveBeenCalled();
  fireEvent.blur(size);
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({change: {size: 96}}),
  );
  const color = screen.getByLabelText('글자색');
  fireEvent.change(color, {target: {value: 'red'}});
  fireEvent.blur(color);
  expect(change).toHaveBeenCalledOnce();
  fireEvent.change(color, {target: {value: '#aabbcc'}});
  fireEvent.keyDown(color, {key: 'Escape'});
  fireEvent.blur(color);
  expect(change).toHaveBeenCalledOnce();
  fireEvent.change(color, {target: {value: '#aabbcc'}});
  fireEvent.blur(color);
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({change: {color: '#AABBCC'}}),
  );
});

it.each([
  {label: '크기', key: 'size', min: 12, max: 300},
  {label: '줄 간격', key: 'lineHeight', min: 0.8, max: 3},
  {label: '최대 줄 수', key: 'maxLines', min: 1, max: 10},
  {label: '여백', key: 'margin', min: 0, max: 30},
])('clamps $key commits to the specified bounds', ({label, key, min, max}) => {
  const {change} = setup();
  const field = screen.getByLabelText(label);
  expect(field.getAttribute('aria-valuemin')).toBe(String(min));
  expect(field.getAttribute('aria-valuemax')).toBe(String(max));
  fireEvent.change(field, {target: {value: String(min - 1)}});
  fireEvent.blur(field);
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({change: {[key]: min}}),
  );
  fireEvent.change(field, {target: {value: String(max + 1)}});
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({change: {[key]: max}}),
  );
});

it('preserves fractional line spacing on commit and uses a 0.05 arrow step', () => {
  const {change} = setup();
  const field = screen.getByLabelText('줄 간격');
  fireEvent.change(field, {target: {value: '1.45'}});
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({change: {lineHeight: 1.45}}),
  );
  fireEvent.keyDown(field, {key: 'ArrowUp'});
  expect(change).toHaveBeenLastCalledWith(
    expect.objectContaining({change: {lineHeight: 1.45}}),
  );
  expect(change).toHaveBeenCalledTimes(2);
});

it('sends a weight-only edit and previews the saved weight', () => {
  const view = setup();
  fireEvent.click(screen.getByLabelText('굵기'));
  fireEvent.click(screen.getByRole('menuitemradio', {name: '400'}));
  expect(view.change).toHaveBeenCalledWith(
    expect.objectContaining({change: {weight: 400}}),
  );
  view.rerender(
    <LyricStyles
      onEffectsChange={vi.fn()}
      looks={{
        ...view.looks,
        lyricStyles: view.looks.lyricStyles.map((style, index) =>
          index === 0 ? {...style, weight: 400} : style,
        ),
      }}
      reason={undefined}
      onChange={view.change}
      onListChange={() => undefined}
      onProblem={vi.fn()}
    />,
  );
  expect(drawing.render.mock.lastCall?.[1]).toHaveProperty(
    'look.lyricStyle.weight',
    400,
  );
});

it('sends field-specific alignment and effect changes and prevents read-only writes', () => {
  const {change, effects, unmount} = setup();
  fireEvent.click(screen.getByRole('radio', {name: '왼쪽'}));
  fireEvent.click(screen.getByRole('switch', {name: '외곽선'}));
  expect(change.mock.calls.map(call => call[0].change)).toEqual([
    {align: 'left'},
  ]);
  expect(effects).toHaveBeenCalledWith(expect.any(String), {
    kind: 'outline',
    change: {on: true},
  });
  unmount();
  const readonly = setup('읽기 전용');
  fireEvent.click(screen.getByRole('radio', {name: '왼쪽'}));
  fireEvent.click(screen.getByRole('switch', {name: '외곽선'}));
  fireEvent.click(screen.getByLabelText('굵기'));
  expect(screen.getByLabelText('굵기').getAttribute('aria-disabled')).toBe(
    'true',
  );
  expect(screen.queryByRole('menuitemradio', {name: '400'})).toBeNull();
  expect(screen.getByLabelText('크기').hasAttribute('readonly')).toBe(true);
  expect(readonly.change).not.toHaveBeenCalled();
});

it('keeps a color draft on modified Enter and Escape', () => {
  const {change} = setup();
  change.mockResolvedValue(true);
  const field = screen.getByLabelText('\uAE00\uC790\uC0C9');
  field.focus();
  fireEvent.change(field, {target: {value: '#123456'}});
  fireEvent.keyDown(field, {key: 'Enter', ctrlKey: true});
  fireEvent.keyDown(field, {key: 'Escape', shiftKey: true});
  expect(document.activeElement).toBe(field);
  expect(field).toHaveProperty('value', '#123456');
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(change).toHaveBeenCalledOnce();
});
