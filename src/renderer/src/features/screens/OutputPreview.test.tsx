import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as v from 'valibot';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import type {MonitorList} from '@core/schema/monitors';
import {screenIdSchema} from '@core/schema/ids';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {OutputPreview} from './OutputPreview';
import {useScreensSelection} from './selection';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/live/state';
import {
  CAPTIONS_ID,
  MAIN_ID,
  screensDocument,
  settingsDocument,
} from './testing/documents';

const drawn = vi.hoisted(() => {
  const created: Array<{mode?: string}> = [];
  const frames: unknown[] = [];
  return {created, frames};
});

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    constructor(_parent: unknown, options: {mode?: string}) {
      drawn.created.push(options);
    }
    render = (_layers: unknown, frame?: unknown) => {
      drawn.frames.push(frame);
    };
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

function setup(document = screensDocument()) {
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = fakeLlpApi({
    monitors: {get: () => Promise.resolve(monitors)},
    settings: {get: () => Promise.resolve(document)},
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
  drawn.created.length = 0;
  drawn.frames.length = 0;
  useScreensSelection.setState({selection: {kind: 'screen', id: null}});
});

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
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
  });

  it('asks for the pattern on the real output and on the real output, and takes it off on 화면 내용', async () => {
    const {patternCommands} = setup();

    await choose('테스트 패턴');

    expect(patternCommands()).toEqual([
      {type: 'screen.testPattern.set', screenId: MAIN_ID, on: true},
    ]);
    await choose('화면 내용');
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
    expect(drawn.created).toHaveLength(1);
    expect(
      screen
        .getByRole('radio', {name: '화면 내용'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('keeps the pattern while a property edit pins the same visible screen', async () => {
    const {patternCommands} = setup();
    await choose('테스트 패턴');
    act(() => useScreensSelection.getState().select('screen', MAIN_ID));
    expect(patternCommands()).toHaveLength(1);
    expect(
      screen
        .getByRole('radio', {name: '테스트 패턴'})
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it.each(['look', 'stage'] as const)(
    'keeps a retained-screen pattern when a %s selection is pinned for correction',
    async kind => {
      const {patternCommands} = setup();
      act(() => useScreensSelection.getState().select(kind, 'selected-row'));
      await choose('테스트 패턴');
      act(() => useScreensSelection.getState().select('screen', MAIN_ID));
      expect(patternCommands()).toEqual([
        {type: 'screen.testPattern.set', screenId: MAIN_ID, on: true},
      ]);
      expect(
        screen
          .getByRole('radio', {name: '테스트 패턴'})
          .getAttribute('aria-checked'),
      ).toBe('true');
      expect(drawn.created).toHaveLength(1);
    },
  );

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

  it('keeps one preview drawing across the modes', async () => {
    setup();
    await screen.findByText('모니터 2 EPSON 프로젝터');

    await choose('테스트 패턴');
    await choose('화면 내용');

    expect(drawn.created.map(options => options.mode)).toEqual(['preview']);
  });

  it('draws the pattern through the preview with the screen correction', async () => {
    const corrected = settingsDocument('screens', {
      screens: [
        {
          id: MAIN_ID,
          name: '본 화면',
          kind: 'audience',
          method: 'fullscreen',
          edgeMargin: 10,
          offset: {x: 20, y: -10},
        },
      ],
    });
    setup(corrected);
    await screen.findByText('본 화면');
    await choose('테스트 패턴');

    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          testPatterns: [v.parse(screenIdSchema, MAIN_ID)],
        },
      }),
    );

    await waitFor(() =>
      expect(drawn.frames.at(-1)).toMatchObject({
        testPattern: true,
        screen: {
          name: '본 화면',
          correction: {edgeMargin: 10, offset: {x: 20, y: -10}},
        },
      }),
    );
  });

  it('sends nothing in the content mode', async () => {
    const {patternCommands} = setup();

    await screen.findByText('모니터 2 EPSON 프로젝터');

    expect(patternCommands()).toEqual([]);
  });

  it('retains the previous screen while a Look holds the selection', async () => {
    useScreensSelection.getState().select('screen', CAPTIONS_ID);
    useScreensSelection.getState().select('look', 'x');
    setup();

    expect(await screen.findByText('방송 자막')).toBeDefined();
  });
});
