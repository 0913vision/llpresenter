import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {UiState} from '@core/schema/uiState';
import {editorFixture} from '@renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import type {LiveCommand} from '@core/live/commands';
import {sampleService} from '@renderer/session/testing/sampleService';
import {applyService} from '@renderer/session/show';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {App} from './App';
import {ControlSession} from './controlSession';
import {mockPanelTabWidths} from '@renderer/ui/responsiveTabTesting';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const NARROW = {width: 1366, height: 768};
const sessions: ControlSession[] = [];

function setup(width: number, height: number, uiState: UiState = {}) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
  const {api} = editorFixture();
  const save = vi.spyOn(api.ui, 'setLayout');
  const send = vi.spyOn(api.live, 'send');
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  render(
    <App
      session={session}
      columnWidthStore={createMemoryColumnWidthStore()}
      uiState={uiState}
    />,
  );
  return {save, send};
}

const serviceOrder = () => screen.queryByRole('region', {name: '예배 순서'});
const COLLAPSE = '사이드바 접기';
const EXPAND = '사이드바 펼치기';
const collapseButton = () => screen.queryByRole('button', {name: COLLAPSE});
const expandButton = () => screen.queryByRole('button', {name: EXPAND});

function sentTypes(
  calls: ReadonlyArray<readonly [LiveCommand]>,
): readonly string[] {
  return calls.flatMap(([command]) =>
    command.type === 'live.batch'
      ? command.commands.map(child => child.type)
      : [command.type],
  );
}

beforeEach(() => {
  mockPanelTabWidths(180);
  useShowToolTab.setState({tool: 'stage'});
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});
afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it('shows the narrow window layout at 1366 x 768', () => {
  setup(NARROW.width, NARROW.height);
  expect(serviceOrder()).not.toBeNull();
  expect(collapseButton()).not.toBeNull();
  expect(screen.getByRole('tab', {name: '\ubb34\ub300'})).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}));
  expect(
    screen.getByRole('menuitemradio', {name: '\uba54\uc2dc\uc9c0'}),
  ).toBeDefined();
  expect(
    screen.getByRole('menuitemradio', {name: '\ud0c0\uc774\uba38'}),
  ).toBeDefined();
});

it('collapses and expands the left column and saves each choice for narrow windows', async () => {
  const {save, send} = setup(NARROW.width, NARROW.height);
  await userEvent.click(screen.getByRole('button', {name: COLLAPSE}));
  expect(serviceOrder()).toBeNull();
  expect(screen.queryByRole('region', {name: '퀵 실행'})).toBeNull();
  expect(save).toHaveBeenLastCalledWith({
    sizeClass: 'narrow',
    leftCollapsed: true,
  });
  await userEvent.click(screen.getByRole('button', {name: EXPAND}));
  expect(serviceOrder()).not.toBeNull();
  expect(save).toHaveBeenLastCalledWith({
    sizeClass: 'narrow',
    leftCollapsed: false,
  });
  expect(save).toHaveBeenCalledTimes(2);
  expect(send).not.toHaveBeenCalled();
});

it('starts collapsed from a saved narrow choice without saving it again', () => {
  const {save} = setup(NARROW.width, NARROW.height, {
    layout: {narrow: {leftCollapsed: true}},
  });
  expect(serviceOrder()).toBeNull();
  expect(expandButton()).not.toBeNull();
  expect(save).not.toHaveBeenCalled();
});

it.each([
  {width: 1920, height: 1080},
  {width: 2560, height: 1440},
])(
  'keeps the left column without 사이드바 접기 at $width x $height',
  ({width, height}) => {
    setup(width, height, {
      layout: {narrow: {leftCollapsed: true}, normal: {leftCollapsed: true}},
    });
    expect(serviceOrder()).not.toBeNull();
    expect(collapseButton()).toBeNull();
    expect(expandButton()).toBeNull();
  },
);

it('keeps the 준비 left column while 진행 has it collapsed', async () => {
  setup(NARROW.width, NARROW.height, {
    layout: {narrow: {leftCollapsed: true}},
  });
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  expect(serviceOrder()).not.toBeNull();
  expect(collapseButton()).toBeNull();
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  expect(serviceOrder()).toBeNull();
});

it('hands the keyboard focus to the other sidebar button', async () => {
  setup(NARROW.width, NARROW.height);
  collapseButton()?.focus();
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(expandButton());
  await userEvent.keyboard('{Enter}');
  expect(document.activeElement).toBe(collapseButton());
});

it('leaves the focus alone when it was outside the left column', async () => {
  setup(NARROW.width, NARROW.height);
  const stage = screen.getByRole('tab', {name: '무대'});
  stage.focus();
  await userEvent.click(screen.getByRole('button', {name: COLLAPSE}));
  expect(document.activeElement).toBe(stage);
});

it('lets the focus fall to the body after a click, so Space is the next slide', async () => {
  applyService(sampleService);
  const {send} = setup(NARROW.width, NARROW.height);
  await userEvent.click(screen.getByRole('option', {name: /아침이 밝아 오네/}));
  await userEvent.click(screen.getByRole('button', {name: COLLAPSE}));
  expect(document.activeElement).not.toBe(expandButton());
  await userEvent.keyboard(' ');
  expect(sentTypes(send.mock.calls)).toContain('slide.show');
  expect(expandButton()).not.toBeNull();
});

it('keeps the chosen 진행 도구 tab through 준비 and back', async () => {
  setup(NARROW.width, NARROW.height);
  await userEvent.click(
    screen.getByRole('button', {name: '\ub354 \ubcf4\uae30'}),
  );
  await userEvent.click(
    screen.getByRole('menuitemradio', {name: '\uba54\uc2dc\uc9c0'}),
  );
  await userEvent.click(screen.getByRole('tab', {name: '준비'}));
  await userEvent.click(screen.getByRole('tab', {name: '진행'}));
  expect(screen.getByRole('tabpanel', {name: '메시지'})).toBeDefined();
  expect(
    screen.getByRole('tab', {name: '메시지'}).getAttribute('aria-selected'),
  ).toBe('true');
});
