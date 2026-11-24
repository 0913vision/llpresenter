import {themeOutput} from '@fixtures/core/themeOutput';
import {Activity} from 'react';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as v from 'valibot';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/schema/live/liveCommand';
import type {MonitorList} from '@core/schema/screens/monitors';
import {screenIdSchema} from '@core/schema/common/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {OutputPreview} from '@renderer/features/screens/OutputPreview';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/schema/live/live';
import {MAIN_ID, screensDocument} from '@fixtures/core/screenDocuments';

vi.mock('@renderer/features/presentation/preview/OutputMirror', () => ({
  OutputMirror: ({screenId}: {screenId: string}) => (
    <div data-testid="output-mirror">{screenId}</div>
  ),
}));

vi.mock('@renderer/ui/panels/useElementSize', () => ({
  useElementSize: () => [vi.fn(), {width: 600, height: 600}],
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

function setup(document = screensDocument(), active = true) {
  const send = vi.fn<(command: LiveCommand) => void>();
  window.llp = mockLlpApi({
    monitors: {get: () => Promise.resolve(monitors)},
    settings: {get: () => Promise.resolve(document)},
    live: {send},
  });
  const view = render(
    <Activity mode={active ? 'visible' : 'hidden'}>
      <OutputPreview />
    </Activity>,
  );
  const patternCommands = () =>
    send.mock.calls
      .map(([command]) => command)
      .filter(command => command.type === 'live.batch');
  return {view, patternCommands};
}

beforeEach(() => {
  useScreensSelection.setState({selection: {id: null}});
});

afterEach(() => {
  cleanup();
  useLive.setState({state: null});
  delete window.llp;
});

async function showPattern(): Promise<void> {
  await userEvent.click(
    await screen.findByRole('button', {name: '테스트 화면'}),
  );
}

describe('the output preview', () => {
  it('shows a pattern for the selected screen and keeps it when the view closes', async () => {
    const {view, patternCommands} = setup();
    await showPattern();
    expect(patternCommands()).toEqual([
      {
        type: 'live.batch',
        commands: [
          {type: 'output.set', screenId: MAIN_ID, on: true},
          {type: 'screen.testPattern.set', screenId: MAIN_ID, on: true},
        ],
      },
    ]);
    view.unmount();
    expect(patternCommands()).toHaveLength(1);
  });

  it('stops mirroring when the output is switched off', async () => {
    setup();
    await screen.findByRole('button', {
      name: '테스트 화면',
    });
    const state = emptyLiveState();
    act(() =>
      useLive.setState({state: {...state, outputs: {[MAIN_ID]: true}}}),
    );
    // NOTE(0913vision): The mirror mounts once the screens document is in,
    // which can take one more turn on a slow machine.
    expect((await screen.findByTestId('output-mirror')).textContent).toBe(
      MAIN_ID,
    );
    act(() => useLive.setState({state}));
    await waitFor(() =>
      expect(screen.queryByTestId('output-mirror')).toBeNull(),
    );
  });

  it('fits the configured output aspect ratio in the available space', async () => {
    const document = settingsDocument('screens', {
      screens: [
        {
          id: MAIN_ID,
          name: 'Audience',
          kind: 'audience',
          method: 'capture',
          resolution: {width: 1024, height: 768},
        },
      ],
    });
    if (document.name !== 'screens') throw new Error('Missing screens');
    const {view} = setup(document);
    await screen.findByRole('button');
    const picture = view.container.querySelector<HTMLElement>(
      '[data-preview-picture]',
    );
    expect(picture?.style.width).toBe('600px');
    expect(picture?.style.height).toBe('450px');
  });

  it('shows the actual output mirror for a test pattern', async () => {
    const corrected = settingsDocument('screens', {
      screens: [
        {
          id: MAIN_ID,
          name: '청중 화면',
          kind: 'audience',
          method: 'fullscreen',
          edgeMargin: 10,
          offset: {x: 20, y: -10},
        },
      ],
    });
    if (corrected.name !== 'screens') throw new Error('Missing screens');
    setup(corrected);
    await screen.findByText('모니터 2 EPSON 프로젝터');
    await showPattern();

    act(() =>
      useLive.setState({
        state: {
          ...emptyLiveState(),
          outputs: {[MAIN_ID]: true},
          themeOutput: themeOutput(),
          testPatterns: [v.parse(screenIdSchema, MAIN_ID)],
        },
      }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('output-mirror').textContent).toBe(MAIN_ID),
    );
  });

  it('sends nothing before the pattern command', async () => {
    const {patternCommands} = setup();

    await screen.findByText('모니터 2 EPSON 프로젝터');

    expect(patternCommands()).toEqual([]);
  });
});
