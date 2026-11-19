import {resolveThemeOutput} from '@core/themes/output';
import {Activity} from 'react';
import {settingsDocument} from '@fixtures/core/settingsDocument';
import {act, cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as v from 'valibot';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import type {MonitorList} from '@core/schema/monitors';
import {screenIdSchema} from '@core/schema/ids';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {OutputPreview} from '@renderer/features/screens/OutputPreview';
import {useScreensSelection} from '@renderer/features/screens/selection';
import {useLive} from '@renderer/session/live';
import {emptyLiveState} from '@core/live/state';
import {MAIN_ID, screensDocument} from '@fixtures/core/screenDocuments';

const drawn = vi.hoisted(() => {
  const created: Array<{mode?: string}> = [];
  const frames: unknown[] = [];
  return {created, frames};
});

vi.mock('@renderer/ui/useElementSize', () => ({
  useElementSize: () => [vi.fn(), {width: 600, height: 600}],
}));

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    ready = () => true;
    revealIncomplete = () => undefined;
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
  drawn.created.length = 0;
  drawn.frames.length = 0;
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

  it('draws the pattern through the preview with the screen correction', async () => {
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
          themeOutput: resolveThemeOutput({
            file: null,
            screens: corrected.value.screens,
            item: null,
            revision: 1,
          }),
          testPatterns: [v.parse(screenIdSchema, MAIN_ID)],
        },
      }),
    );

    await waitFor(() =>
      expect(drawn.frames.at(-1)).toMatchObject({
        testPattern: true,
        screen: {
          name: '청중 화면',
          correction: {edgeMargin: 10, offset: {x: 20, y: -10}},
        },
      }),
    );
  });

  it('sends nothing before the pattern command', async () => {
    const {patternCommands} = setup();

    await screen.findByText('모니터 2 EPSON 프로젝터');

    expect(patternCommands()).toEqual([]);
  });
});
