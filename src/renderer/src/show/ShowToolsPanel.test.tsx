import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it} from 'vitest';
import {useShowToolTab} from '@renderer/state/showToolTab';
import {
  settingsDocument,
  CAPTIONS_ID,
  LAYOUT_ID,
  LOOK_ID,
  STAGE_ID,
} from '@renderer/screens/testing/documents';
import {ShowToolsPanel} from './ShowToolsPanel';
import {SHOW_TOOLS} from './showTools';
import {stageFixture} from './tools/stageTesting';

let fixture: ReturnType<typeof stageFixture>;
beforeEach(() => {
  useShowToolTab.setState({tool: 'stage'});
  fixture = stageFixture();
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

it.each(['normal', 'wide', 'narrow'] as const)(
  'shows only working tabs in a %s window without an empty overflow menu',
  async sizeClass => {
    render(<ShowToolsPanel sizeClass={sizeClass} />);
    await stageReady();
    expect(tabNames()).toEqual(['표시 중', '무대', '타이머', '메시지']);
    expect(screen.queryByRole('button', {name: '더 보기'})).toBeNull();
    expect(
      screen.getByRole('tab', {name: '무대'}).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      within(screen.getByRole('tabpanel', {name: '무대'})).getByRole('button', {
        name: '무대 타이머',
      }),
    ).toBeDefined();
  },
);

it.each(
  SHOW_TOOLS.filter(
    tab =>
      tab.value !== 'showing' &&
      tab.value !== 'stage' &&
      tab.value !== 'timer' &&
      tab.value !== 'message',
  ),
)(
  'opens working stage controls for a previously selected hidden tab: $label',
  async tab => {
    useShowToolTab.setState({tool: tab.value});
    render(<ShowToolsPanel sizeClass="normal" />);
    await stageReady();
    expect(tabNames()).toEqual(['표시 중', '무대', '타이머', '메시지']);
    expect(screen.queryByRole('tab', {name: tab.label})).toBeNull();
    expect(
      screen.getByRole('tab', {name: '무대'}).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen.getByRole('tabpanel', {name: '무대'}).childElementCount,
    ).toBeGreaterThan(0);
  },
);

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

it('selects only working panels with arrow keys and releases their subscriptions', async () => {
  const {unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
  await stageReady();
  screen.getByRole('tab', {name: '무대'}).focus();
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(fixture.count()).toBe(1));
  expect(
    screen.getByRole('tabpanel', {name: '타이머'}).childElementCount,
  ).toBeGreaterThan(0);
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(fixture.count()).toBe(2));
  expect(
    screen.getByRole('tabpanel', {name: '메시지'}).childElementCount,
  ).toBeGreaterThan(0);
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(fixture.count()).toBe(5));
  expect(screen.getByRole('tabpanel', {name: '표시 중'})).toBeDefined();
  await userEvent.keyboard('{ArrowRight}');
  await stageReady();
  expect(screen.getByRole('tabpanel', {name: '무대'})).toBeDefined();
  unmount();
  expect(fixture.count()).toBe(0);
});

it('keeps the chosen working panel through size changes and remounting', async () => {
  const {rerender, unmount} = render(<ShowToolsPanel sizeClass="narrow" />);
  await stageReady();
  await userEvent.click(screen.getByRole('tab', {name: '메시지'}));
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
