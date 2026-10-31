import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {
  settingsDocument,
  CAPTIONS_ID,
  LAYOUT_ID,
  LOOK_ID,
  STAGE_ID,
} from '@core/testing/screenDocuments';
import {ShowToolsPanel} from './ShowToolsPanel';
import {stageFixture} from './stageTesting';

let fixture: ReturnType<typeof stageFixture>;
beforeEach(() => {
  useShowToolTab.setState({tool: 'stage'});
  fixture = stageFixture([
    settingsDocument('props', {props: []}),
    settingsDocument('notices', {sets: []}),
    settingsDocument('macros', {
      macros: [
        {
          id: '00000000-0000-4000-8000-000000000001',
          name: 'Test macro',
          icon: 'macro',
          color: 'teal',
          actions: [],
        },
      ],
      collections: [],
    }),
  ]);
});
afterEach(() => {
  cleanup();
  delete window.llp;
});

const tabNames = (): readonly string[] =>
  within(screen.getByRole('tablist'))
    .getAllByRole('tab')
    .map(tab => tab.textContent);
const stageReady = () => waitFor(() => expect(fixture.count()).toBe(8));

it.each([
  [
    'normal',
    [
      '\ud45c\uc2dc \uc911',
      '\uc624\ub514\uc624',
      '\ubb34\ub300',
      '\ud0c0\uc774\uba38',
    ],
    [
      '\uba54\uc2dc\uc9c0',
      '\uacf5\uc9c0',
      '\uc18c\ud488',
      '\ub9e4\ud06c\ub85c',
    ],
  ],
  [
    'wide',
    [
      '\ud45c\uc2dc \uc911',
      '\uc624\ub514\uc624',
      '\ubb34\ub300',
      '\ud0c0\uc774\uba38',
    ],
    [
      '\uba54\uc2dc\uc9c0',
      '\uacf5\uc9c0',
      '\uc18c\ud488',
      '\ub9e4\ud06c\ub85c',
    ],
  ],
  [
    'narrow',
    ['\ud45c\uc2dc \uc911', '\ubb34\ub300'],
    [
      '\uc624\ub514\uc624',
      '\ud0c0\uc774\uba38',
      '\uba54\uc2dc\uc9c0',
      '\uacf5\uc9c0',
      '\uc18c\ud488',
      '\ub9e4\ud06c\ub85c',
    ],
  ],
] as const)(
  'keeps every tool accessible in a %s window',
  async (sizeClass, visible, overflow) => {
    render(<ShowToolsPanel sizeClass={sizeClass} />);
    await stageReady();
    expect(tabNames()).toEqual(visible);
    await userEvent.click(
      screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
    );
    const menu = screen.getByRole('menu', {name: '\ub354 \ubcf4\uae30'});
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map(item => item.textContent),
    ).toEqual(overflow);
    for (const [index, name] of overflow.entries()) {
      if (index > 0) {
        await userEvent.click(
          screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
        );
      }
      await userEvent.click(screen.getByRole('menuitemradio', {name}));
      expect(screen.getByRole('tabpanel', {name})).toBeDefined();
    }
    expect(
      screen.getByRole('tabpanel', {name: '\ub9e4\ud06c\ub85c'}),
    ).toBeDefined();
    expect(
      screen
        .getByRole('button', {name: '\ub354 \ubcf4\uae30'})
        .hasAttribute('data-active'),
    ).toBe(true);
  },
);

it('opens macro controls and marks the latest live macro', async () => {
  render(<ShowToolsPanel sizeClass="normal" />);
  await stageReady();
  await userEvent.click(
    screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
  );
  await userEvent.click(
    screen.getByRole('menuitemradio', {name: '\ub9e4\ud06c\ub85c'}),
  );
  const tile = await screen.findByRole('option', {name: 'Test macro'});
  fixture.live({lastMacroId: '00000000-0000-4000-8000-000000000001'});
  await waitFor(() => expect(tile.getAttribute('data-state')).toBe('last-run'));
  expect(
    screen.getByRole('tabpanel', {name: '\ub9e4\ud06c\ub85c'}),
  ).toBeDefined();
});

it('shows the live row count on the 표시 중 tab while stage tab is selected', async () => {
  const singleAudienceLooks = settingsDocument('looks', {
    current: LOOK_ID,
    looks: [
      {
        id: LOOK_ID,
        name: '평상시',
        screens: {
          [STAGE_ID]: {layers: {}, stageLayout: LAYOUT_ID},
          [CAPTIONS_ID]: {layers: {slide: false}},
        },
      },
    ],
    lyricStyles: [],
  });
  fixture = stageFixture([singleAudienceLooks]);
  fixture.live({
    lookId: LOOK_ID,
    layers: {
      media: null,
      prop: null,
      audio: null,
      message: null,
      notice: null,
      slide: {
        itemId: 'song-1',
        position: 0,
        label: '1절',
        lines: ['가사 첫째 줄'],
      },
    },
  });
  render(<ShowToolsPanel sizeClass="normal" />);
  await stageReady();
  expect(
    screen.getByRole('tab', {name: '무대'}).getAttribute('aria-selected'),
  ).toBe('true');
  await waitFor(() => {
    expect(screen.getByRole('tab', {name: '표시 중 1개'})).toBeDefined();
  });
});

it('switches compact tabs and overflow panels and releases subscriptions', async () => {
  const {unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
  await stageReady();
  screen.getByRole('tab', {name: '\ubb34\ub300'}).focus();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(fixture.count()).toBe(8));
  expect(
    screen.getByRole('tabpanel', {name: '\ud45c\uc2dc \uc911'}),
  ).toBeDefined();
  for (const [name, count] of [
    ['\ud0c0\uc774\uba38', 4],
    ['\uba54\uc2dc\uc9c0', 5],
    ['\uacf5\uc9c0', 5],
    ['\uc18c\ud488', 5],
    ['\ub9e4\ud06c\ub85c', 4],
    ['\uc624\ub514\uc624', 3],
  ] as const) {
    await userEvent.click(
      screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
    );
    await userEvent.click(screen.getByRole('menuitemradio', {name}));
    await waitFor(() => expect(fixture.count()).toBe(count));
    expect(screen.getByRole('tabpanel', {name})).toBeDefined();
  }
  unmount();
  expect(fixture.count()).toBe(0);
});

it('keeps the chosen working panel through size changes and remounting', async () => {
  const {rerender, unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
  await stageReady();
  await userEvent.click(
    screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
  );
  await userEvent.click(
    screen.getByRole('menuitemradio', {name: '\uba54\uc2dc\uc9c0'}),
  );
  await waitFor(() => expect(fixture.count()).toBe(5));
  rerender(<ShowToolsPanel sizeClass="normal" />);
  expect(
    screen
      .getByRole('button', {name: '\ub354 \ubcf4\uae30'})
      .getAttribute('data-active'),
  ).toBe('true');
  unmount();
  expect(fixture.count()).toBe(0);
  render(<ShowToolsPanel sizeClass="wide" />);
  await waitFor(() => expect(fixture.count()).toBe(5));
  expect(screen.getByRole('tabpanel', {name: '메시지'})).toBeDefined();
});
