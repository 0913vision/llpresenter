import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {beforeEach, expect, it, vi} from 'vitest';
import {createItemOverlayId, createMediaId} from '@core/schema/common/ids';
import type {PlacedOverlay} from '@core/schema/services/itemOverlays';
import type {MediaItem} from '@core/schema/media/mediaList';
import {OverlayClips} from '@renderer/features/service/overlays/OverlayClip';
import {
  useOverlayControl,
  type OverlayControl,
} from '@renderer/features/service/overlays/useOverlayControl';
import {menuItems} from '@renderer/ui/menus/menuModel';
import {
  THEME_MAIN,
  THEME_STAGE,
  themeScreens,
} from '@fixtures/core/themeOutput';

const VIDEO = createMediaId('00000000-0000-4000-8000-000000000071');
const media: readonly MediaItem[] = [
  {id: VIDEO, name: '특송 반주', kind: 'video', file: 'invented.mp4', size: 1},
];

function overlayId(number: number) {
  return createItemOverlayId(
    `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  );
}
function clip(number: number, from: number, to: number): PlacedOverlay {
  return {
    id: overlayId(number),
    name: `오버레이 ${number}`,
    from,
    to,
    screens: [THEME_MAIN],
    content: {text: `글 ${number}`},
  };
}

/** Six slides in two rows of three, each 100 wide and 60 high. */
function layOut(): void {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      const index = Number(this.getAttribute('data-slide-index') ?? -1);
      return index < 0
        ? new DOMRect(0, 0, 300, 120)
        : new DOMRect((index % 3) * 100, Math.floor(index / 3) * 60, 100, 60);
    },
  );
}

function setup(
  first: readonly PlacedOverlay[],
  {reason}: {readonly reason?: string} = {},
) {
  const current: {
    overlays: readonly PlacedOverlay[];
    control: OverlayControl | null;
  } = {overlays: first, control: null};
  function Harness(): JSX.Element {
    const [overlays, setOverlays] = useState(first);
    current.overlays = overlays;
    const control = useOverlayControl({
      overlays,
      count: 6,
      reason,
      screens: themeScreens,
      defaultScreens: [THEME_MAIN],
      media,
      change: change => {
        setOverlays(change);
        return Promise.resolve(true);
      },
    });
    current.control = control;
    return (
      <div>
        {Array.from({length: 6}, (_, index) => (
          <div key={index} data-slide-index={index} />
        ))}
        <OverlayClips control={control} revision="1" />
        {control.dialog}
      </div>
    );
  }
  render(<Harness />);
  const entries = (position: number) => {
    if (current.control === null) throw new Error('No control');
    return menuItems(current.control.entries(position));
  };
  return {
    current,
    entries,
    run: (position: number, label: string) =>
      act(() =>
        entries(position)
          .find(entry => entry.label === label)
          ?.onSelect?.(),
      ),
  };
}

function bars() {
  return screen.getAllByRole('button', {name: /슬라이드 \d부터/u});
}

beforeEach(layOut);

it('draws a bar for each row of slides that an overlay covers', () => {
  setup([clip(1, 2, 5)]);
  expect(
    [...document.querySelectorAll<HTMLElement>('[data-overlay-clip]')].map(
      ({style}) => [style.left, style.top, style.width],
    ),
  ).toEqual([
    ['100px', '60px', '200px'],
    ['0px', '120px', '200px'],
  ]);
  expect(bars()).toHaveLength(1);
  expect(document.querySelectorAll('[data-edge]')).toHaveLength(2);
});

it('adds a text from the menu of a slide, up to the next overlay', async () => {
  const {current, run} = setup([clip(1, 4, 5)]);
  run(2, '오버레이 추가…');
  await userEvent.type(
    screen.getByRole('textbox', {name: '오버레이 글자'}),
    '자막',
  );
  await userEvent.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() => expect(current.overlays).toHaveLength(2));
  expect(current.overlays[1]).toMatchObject({
    from: 2,
    to: 3,
    screens: [THEME_MAIN],
    content: {text: '자막'},
  });
});

it('replaces or removes the overlay of a slide that has one', async () => {
  const {current, entries, run} = setup([clip(1, 2, 3)]);
  expect(entries(2).map(entry => entry.label)).toEqual([
    '오버레이 바꾸기…',
    '오버레이 삭제',
  ]);
  run(2, '오버레이 바꾸기…');
  await userEvent.click(screen.getByRole('radio', {name: '미디어'}));
  await userEvent.click(screen.getByRole('button', {name: '오버레이 미디어'}));
  fireEvent.click(screen.getByRole('option', {name: '특송 반주'}));
  await userEvent.click(screen.getByRole('button', {name: '적용'}));
  await waitFor(() =>
    expect(current.overlays[0]?.content).toEqual({
      media: VIDEO,
      loop: false,
      sound: false,
    }),
  );
  run(2, '오버레이 삭제');
  await waitFor(() => expect(current.overlays).toEqual([]));
});

it('changes the range by dragging an end, short of the next overlay', async () => {
  const {current} = setup([clip(1, 1, 2), clip(2, 5, 6)]);
  const handle = document.querySelector<HTMLElement>('[data-edge="to"]');
  if (handle === null) throw new Error('Missing handle');
  fireEvent.pointerDown(handle);
  fireEvent(
    document,
    new MouseEvent('pointermove', {clientX: 250, clientY: 30}),
  );
  fireEvent(
    document,
    new MouseEvent('pointermove', {clientX: 290, clientY: 110}),
  );
  fireEvent(document, new MouseEvent('pointerup'));
  await waitFor(() =>
    expect(current.overlays[0]).toMatchObject({from: 1, to: 4}),
  );
});

it('opens the settings of a clip and changes its screens', async () => {
  const {current} = setup([clip(1, 1, 2)]);
  await userEvent.click(bars()[0] ?? document.body);
  expect(
    screen.getByRole('dialog', {name: '오버레이 1 오버레이'}),
  ).toBeTruthy();
  await userEvent.click(screen.getByRole('checkbox', {name: 'Stage'}));
  await waitFor(() =>
    expect(current.overlays[0]?.screens).toEqual([THEME_MAIN, THEME_STAGE]),
  );
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('loops a video and plays its sound when that is chosen', async () => {
  const {current} = setup([
    {
      ...clip(1, 1, 2),
      content: {media: VIDEO, loop: false, sound: false},
    },
  ]);
  await userEvent.click(bars()[0] ?? document.body);
  await userEvent.click(screen.getByRole('radio', {name: '반복'}));
  await userEvent.click(screen.getByRole('checkbox', {name: '소리'}));
  await waitFor(() =>
    expect(current.overlays[0]?.content).toEqual({
      media: VIDEO,
      loop: true,
      sound: true,
    }),
  );
});

it('removes a chosen clip with Delete', async () => {
  const {current} = setup([clip(1, 1, 2)]);
  const bar = bars()[0];
  if (bar === undefined) throw new Error('Missing clip');
  bar.focus();
  fireEvent.keyDown(bar, {key: 'Delete'});
  await waitFor(() => expect(current.overlays).toEqual([]));
});

it('changes nothing in a file of a newer version', () => {
  const {entries} = setup([clip(1, 1, 2)], {reason: '읽기 전용'});
  expect(entries(4).map(entry => entry.disabled)).toEqual([true]);
  expect(entries(1).every(entry => entry.disabled === true)).toBe(true);
});
