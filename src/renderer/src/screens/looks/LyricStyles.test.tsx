import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {looksSchema} from '@shared/schema/looks';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {looksDocument} from '../testing/documents';
import {LyricStyles} from './LyricStyles';
import type {LyricStyleEdit} from './lyricStyleEdits';

const drawing = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@renderer/render/outputRenderer', () => ({
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
  const change = vi.fn<(edit: LyricStyleEdit) => void>();
  const view = render(
    <LyricStyles
      looks={looks}
      reason={reason}
      onChange={change}
      onListChange={() => undefined}
      onProblem={vi.fn()}
    />,
  );
  return {...view, change, looks};
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
  const {change, unmount} = setup();
  fireEvent.click(screen.getByRole('radio', {name: '왼쪽'}));
  fireEvent.click(screen.getByRole('switch', {name: '외곽선'}));
  expect(change.mock.calls.map(call => call[0].change)).toEqual([
    {align: 'left'},
    {outline: true},
  ]);
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
