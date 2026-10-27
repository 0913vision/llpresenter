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
  return {...view, change};
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
  expect(screen.getByLabelText('크기').hasAttribute('readonly')).toBe(true);
  expect(readonly.change).not.toHaveBeenCalled();
});
