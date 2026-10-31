import {settingsDocument} from '@core/testing/settingsDocument';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {ShowToolsPanel} from './ShowToolsPanel';
import {stageFixture} from './stageTesting';
import {mockPanelTabWidths} from '@renderer/ui/responsiveTabTesting';

let fixture: ReturnType<typeof stageFixture>;
let widths: ReturnType<typeof mockPanelTabWidths>;
beforeEach(() => {
  widths = mockPanelTabWidths(300);
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
const stageReady = () => waitFor(() => expect(fixture.count()).toBe(5));

it.each([
  [
    'normal',
    [
      '\uc624\ub514\uc624',
      '\ubb34\ub300',
      '\ud0c0\uc774\uba38',
      '\uba54\uc2dc\uc9c0',
    ],
    ['\uacf5\uc9c0', '그래픽', '\ub9e4\ud06c\ub85c'],
  ],
  [
    'wide',
    [
      '\uc624\ub514\uc624',
      '\ubb34\ub300',
      '\ud0c0\uc774\uba38',
      '\uba54\uc2dc\uc9c0',
      '\uacf5\uc9c0',
      '그래픽',
      '\ub9e4\ud06c\ub85c',
    ],
    [],
  ],
  [
    'narrow',
    ['오디오', '무대'],
    [
      '\ud0c0\uc774\uba38',
      '\uba54\uc2dc\uc9c0',
      '\uacf5\uc9c0',
      '그래픽',
      '\ub9e4\ud06c\ub85c',
    ],
  ],
] as const)(
  'keeps every tool accessible in a %s window',
  async (sizeClass, visible, overflow) => {
    widths.resize(
      sizeClass === 'wide' ? 1000 : sizeClass === 'narrow' ? 180 : 300,
    );
    render(<ShowToolsPanel sizeClass={sizeClass} />);
    await stageReady();
    expect(tabNames()).toEqual(visible);
    expect(screen.queryByRole('tab', {name: /표시 중/})).toBeNull();
    if (overflow.length === 0) {
      expect(screen.queryByRole('button', {name: '더 보기'})).toBeNull();
      return;
    }
    await userEvent.click(
      screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
    );
    const menu = screen.getByRole('menu', {name: '\ub354 \ubcf4\uae30'});
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map(item => item.textContent),
    ).toEqual(overflow);
    expect(
      within(menu).queryByRole('menuitemradio', {name: /표시 중/}),
    ).toBeNull();
    for (const [index, name] of overflow.entries()) {
      if (index > 0) {
        await userEvent.click(
          screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
        );
      }
      await userEvent.click(screen.getByRole('menuitemradio', {name}));
      expect(screen.getByRole('tabpanel', {name})).toBeDefined();
      expect(
        screen.getByRole('tab', {name}).getAttribute('aria-selected'),
      ).toBe('true');
    }
    expect(
      screen.getByRole('tabpanel', {name: '\ub9e4\ud06c\ub85c'}),
    ).toBeDefined();
    expect(
      screen
        .getByRole('button', {name: '\ub354 \ubcf4\uae30'})
        .hasAttribute('data-active'),
    ).toBe(false);
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

it('switches compact tabs and overflow panels and releases subscriptions', async () => {
  widths.resize(180);
  const {unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
  await stageReady();
  screen.getByRole('tab', {name: '\ubb34\ub300'}).focus();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(fixture.count()).toBe(0));
  expect(screen.getByRole('tabpanel', {name: '오디오'})).toBeDefined();
  for (const [name, count] of [
    ['\ud0c0\uc774\uba38', 1],
    ['\uba54\uc2dc\uc9c0', 2],
    ['\uacf5\uc9c0', 2],
    ['그래픽', 2],
    ['\ub9e4\ud06c\ub85c', 1],
    ['\uc624\ub514\uc624', 0],
  ] as const) {
    const tab = screen.queryByRole('tab', {name});
    if (tab) await userEvent.click(tab);
    else {
      await userEvent.click(screen.getByRole('button', {name: '더 보기'}));
      await userEvent.click(screen.getByRole('menuitemradio', {name}));
    }
    await waitFor(() => expect(fixture.count()).toBe(count));
    expect(screen.getByRole('tabpanel', {name})).toBeDefined();
  }
  unmount();
  expect(fixture.count()).toBe(0);
});

it('keeps the chosen working panel through size changes and remounting', async () => {
  widths.resize(180);
  const {rerender, unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
  await stageReady();
  await userEvent.click(
    screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
  );
  await userEvent.click(
    screen.getByRole('menuitemradio', {name: '\uba54\uc2dc\uc9c0'}),
  );
  await waitFor(() => expect(fixture.count()).toBe(2));
  rerender(<ShowToolsPanel sizeClass="normal" />);
  expect(
    screen.getByRole('tab', {name: '메시지'}).getAttribute('aria-selected'),
  ).toBe('true');
  unmount();
  expect(fixture.count()).toBe(0);
  render(<ShowToolsPanel sizeClass="wide" />);
  await waitFor(() => expect(fixture.count()).toBe(2));
  expect(screen.getByRole('tabpanel', {name: '메시지'})).toBeDefined();
});
