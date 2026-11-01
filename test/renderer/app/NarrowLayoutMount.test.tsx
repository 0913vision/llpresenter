import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {UiState} from '@core/schema/uiState';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import type {LiveCommand} from '@core/live/commands';
import {sampleService} from '@fixtures/renderer/session/sampleService';
import {applyService} from '@renderer/session/show';
import {useShowToolTab} from '@renderer/features/tools/state/showToolTab';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';
import {mockPanelTabWidths} from '@fixtures/renderer/ui/responsiveTabTesting';

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
