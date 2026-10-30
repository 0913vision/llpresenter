import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {looksSchema} from '@core/schema/looks';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {Properties} from '@renderer/ui/PropertyRow';
import {looksDocument} from '../testing/documents';
import {LyricEffectsProperties} from './LyricEffectsProperties';

afterEach(cleanup);

function setup(reason?: string) {
  const document = looksDocument();
  if (document.name !== 'looks') throw new Error('Wrong fixture');
  const file = v.parse(looksSchema, {
    ...document.value,
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-000000000301',
        name: '기본',
        outline: {on: true, width: 3, color: '#000000'},
        shadow: {
          on: true,
          blur: 8,
          distance: 4,
          angle: 45,
          opacity: 60,
          color: '#000000',
        },
        referencePosition: 'bottomRight',
      },
    ],
  });
  const style = file.lyricStyles[0];
  if (style === undefined) throw new Error('Missing style');
  const change = vi.fn();
  const view = render(
    <Properties>
      <LyricEffectsProperties style={style} reason={reason} onChange={change} />
    </Properties>,
  );
  return {change, user: userEvent.setup(), style, view};
}

it('edits independent effect fields within their bounds and retains details on toggle', async () => {
  const {change, user} = setup();
  await user.click(screen.getByRole('switch', {name: '외곽선'}));
  expect(change).toHaveBeenCalledWith({kind: 'outline', change: {on: false}});
  for (const [name, text, expected, kind, key] of [
    ['외곽선 두께', '99', 10, 'outline', 'width'],
    ['그림자 흐림', '99', 40, 'shadow', 'blur'],
    ['그림자 거리', '99', 20, 'shadow', 'distance'],
    ['그림자 각도', '999', 360, 'shadow', 'angle'],
    ['그림자 불투명도', '999', 100, 'shadow', 'opacity'],
  ] as const) {
    const field = screen.getByRole('spinbutton', {name});
    await user.clear(field);
    await user.type(field, `${text}{Enter}`);
    expect(change).toHaveBeenCalledWith({kind, change: {[key]: expected}});
  }
  const color = screen.getByRole('textbox', {name: '외곽선 색'});
  await user.clear(color);
  await user.type(color, '#aa2200{Enter}');
  expect(change).toHaveBeenCalledWith({
    kind: 'outline',
    change: {color: '#AA2200'},
  });
  await user.click(screen.getByRole('button', {name: '그림자 색 선택'}));
  expect(screen.getByRole('dialog', {name: '그림자 색 선택'})).toBeDefined();
  await user.click(screen.getByRole('button', {name: '취소'}));
  await user.click(screen.getByRole('button', {name: '출처 위치'}));
  await user.click(screen.getByRole('menuitemradio', {name: '마지막 줄 다음'}));
  expect(change).toHaveBeenCalledWith({
    kind: 'referencePosition',
    value: 'afterLastLine',
  });
});

it('rejects invalid colors and blocks all edits for read-only settings', async () => {
  const {change, user} = setup('읽기 전용');
  const field = screen.getByRole('textbox', {name: '그림자 색'});
  expect(field).toHaveProperty('readOnly', true);
  await user.type(field, '#aa');
  await user.click(screen.getByRole('switch', {name: '그림자'}));
  await user.click(screen.getByRole('button', {name: '출처 위치'}));
  expect(change).not.toHaveBeenCalled();
  expect(
    screen
      .getByRole('button', {name: '출처 위치'})
      .getAttribute('aria-disabled'),
  ).toBe('true');
});

it('shows invalid color feedback and restores the saved value on blur', async () => {
  const {change, user} = setup();
  const field = screen.getByRole('textbox', {name: '그림자 색'});
  await user.clear(field);
  await user.type(field, '#12');
  expect(field.getAttribute('aria-invalid')).toBe('true');
  await user.tab();
  await waitFor(() => expect(field).toHaveProperty('value', '#000000'));
  expect(change).not.toHaveBeenCalled();
});

it('keeps disabled effect details visible without allowing edits', async () => {
  const {change, style} = setup();
  cleanup();
  render(
    <Properties>
      <LyricEffectsProperties
        style={{
          ...style,
          outline: {...style.outline, on: false},
          shadow: {...style.shadow, on: false},
        }}
        reason={undefined}
        onChange={change}
      />
    </Properties>,
  );
  const width = screen.getByRole('spinbutton', {name: '외곽선 두께'});
  const angle = screen.getByRole('spinbutton', {name: '그림자 각도'});
  expect(width).toHaveProperty('value', '3');
  expect(angle).toHaveProperty('value', '45°');
  expect(width).toHaveProperty('readOnly', true);
  expect(angle).toHaveProperty('readOnly', true);
  expect(screen.getByRole('textbox', {name: '외곽선 색'})).toHaveProperty(
    'readOnly',
    true,
  );
  expect(change).not.toHaveBeenCalled();
});

it.each([
  {
    label: '외곽선 두께',
    first: '6',
    original: '3',
    kind: 'outline',
    key: 'width',
  },
  {
    label: '그림자 흐림',
    first: '12',
    original: '8',
    kind: 'shadow',
    key: 'blur',
  },
])(
  'queues a $label reversion while its save is held',
  ({label, first, original, kind, key}) => {
    const {change} = setup();
    change.mockImplementation(() => new Promise<boolean>(() => undefined));
    const field = screen.getByRole('spinbutton', {name: label});
    for (const value of [first, original]) {
      fireEvent.change(field, {target: {value}});
      fireEvent.keyDown(field, {key: 'Enter'});
    }
    expect(change).toHaveBeenCalledTimes(2);
    expect(change).toHaveBeenLastCalledWith({
      kind,
      change: {[key]: Number(original)},
    });
  },
);

it('retains the latest effect value through earlier save publications', async () => {
  const {change, style, view} = setup();
  const replies: Array<(value: boolean) => void> = [];
  change.mockImplementation(
    () =>
      new Promise<boolean>(resolve => {
        replies.push(resolve);
      }),
  );
  const width = screen.getByRole('spinbutton', {name: '외곽선 두께'});
  for (const value of ['6', '3', '6']) {
    fireEvent.change(width, {target: {value}});
    fireEvent.keyDown(width, {key: 'Enter'});
  }
  await act(async () => {
    replies[0]?.(true);
  });
  view.rerender(
    <Properties>
      <LyricEffectsProperties
        style={{...style, outline: {...style.outline, width: 6}}}
        reason={undefined}
        onChange={change}
      />
    </Properties>,
  );
  await act(async () => {
    replies[1]?.(true);
  });
  view.rerender(
    <Properties>
      <LyricEffectsProperties
        style={style}
        reason={undefined}
        onChange={change}
      />
    </Properties>,
  );
  expect(width).toHaveProperty('value', '6');
  fireEvent.change(width, {target: {value: '3'}});
  fireEvent.keyDown(width, {key: 'Enter'});
  expect(change).toHaveBeenCalledTimes(4);
});

it('restores the published effect value when the latest save is refused', async () => {
  const {change} = setup();
  let reply: (value: boolean) => void = () => undefined;
  const held = new Promise<boolean>(resolve => {
    reply = resolve;
  });
  change.mockReturnValue(held);
  const width = screen.getByRole('spinbutton', {name: '외곽선 두께'});
  fireEvent.change(width, {target: {value: '6'}});
  fireEvent.keyDown(width, {key: 'Enter'});
  expect(width).toHaveProperty('value', '6');
  await act(async () => {
    reply(false);
    await held;
  });
  expect(width).toHaveProperty('value', '3');
});
