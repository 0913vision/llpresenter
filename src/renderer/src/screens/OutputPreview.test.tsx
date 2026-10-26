import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import type {MonitorList} from '@shared/schema/monitors';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {OutputPreview} from './OutputPreview';
import {useScreensSelection} from './selection';
import {CAPTIONS_ID, MAIN_ID, screensDocument} from './testing/documents';

vi.mock('@renderer/render/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const monitors: MonitorList = [
  {
    number: 2,
    name: 'EPSON 프로젝터',
    bounds: {x: 1920, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow: false,
    screenIds: [MAIN_ID],
  },
];

function setup() {
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = fakeLlpApi({
    monitors: {get: () => Promise.resolve(monitors)},
    settings: {get: () => Promise.resolve(screensDocument())},
    live: {send},
  });
  const view = render(<OutputPreview />);
  const patternCommands = () =>
    send.mock.calls
      .map(([command]) => command)
      .filter(command => command.type === 'screen.testPattern.set');
  return {view, patternCommands};
}

beforeEach(() => {
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
});

afterEach(() => {
  cleanup();
  delete window.llp;
});

async function choose(name: string): Promise<void> {
  await userEvent.click(await screen.findByRole('radio', {name}));
}

describe('the output preview', () => {
  it('shows the first screen with its caption and the content mode', async () => {
    setup();

    expect(await screen.findByText('모니터 2 EPSON 프로젝터')).toBeTruthy();
    expect(screen.getByText('1920×1080 60Hz')).toBeTruthy();
    expect(
      screen
        .getByRole('radio', {name: '화면 내용'})
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.queryByTestId('test-pattern')).toBeNull();
  });

  it('shows the pattern here and on the real output, and takes it off on 화면 내용', async () => {
    const {patternCommands} = setup();

    await choose('테스트 패턴');

    expect(screen.getByTestId('test-pattern')).toBeTruthy();
    expect(patternCommands()).toEqual([
      {type: 'screen.testPattern.set', screenId: MAIN_ID, on: true},
    ]);
    await choose('화면 내용');
    expect(screen.queryByTestId('test-pattern')).toBeNull();
    expect(patternCommands().at(-1)).toEqual({
      type: 'screen.testPattern.set',
      screenId: MAIN_ID,
      on: false,
    });
  });

  it('takes the pattern off when another screen is selected and starts it in 화면 내용', async () => {
    const {patternCommands} = setup();
    await choose('테스트 패턴');

    act(() => useScreensSelection.getState().select('screen', CAPTIONS_ID));

    await waitFor(() => expect(patternCommands()).toHaveLength(2));
    expect(patternCommands().at(-1)).toEqual({
      type: 'screen.testPattern.set',
      screenId: MAIN_ID,
      on: false,
    });
    expect(screen.queryByTestId('test-pattern')).toBeNull();
    expect(
      screen
        .getByRole('radio', {name: '화면 내용'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('takes the pattern off when a Look takes the selection', async () => {
    const {patternCommands} = setup();
    await choose('테스트 패턴');

    act(() => useScreensSelection.getState().select('look', 'x'));

    expect(patternCommands().at(-1)).toEqual({
      type: 'screen.testPattern.set',
      screenId: MAIN_ID,
      on: false,
    });
  });

  it('takes the pattern off when the window is going away', async () => {
    const {patternCommands} = setup();
    await choose('테스트 패턴');

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(patternCommands().at(-1)).toEqual({
      type: 'screen.testPattern.set',
      screenId: MAIN_ID,
      on: false,
    });
  });

  it('stops listening for the window going away after the pattern is off', async () => {
    const {patternCommands} = setup();
    await choose('테스트 패턴');
    await choose('화면 내용');
    const sent = patternCommands().length;

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(patternCommands()).toHaveLength(sent);
  });

  it('takes the pattern off when the operator leaves 화면 설정', async () => {
    const {view, patternCommands} = setup();
    await choose('테스트 패턴');

    view.unmount();

    expect(patternCommands().at(-1)).toEqual({
      type: 'screen.testPattern.set',
      screenId: MAIN_ID,
      on: false,
    });
  });

  it('sends nothing in the content mode', async () => {
    const {patternCommands} = setup();

    await screen.findByText('모니터 2 EPSON 프로젝터');

    expect(patternCommands()).toEqual([]);
  });

  it('shows nothing while a Look holds the selection', async () => {
    useScreensSelection.setState({selection: {kind: 'look', id: 'x'}});
    const {view} = setup();

    await waitFor(() => expect(window.llp).toBeDefined());
    expect(view.container.textContent).toBe('');
  });
});
