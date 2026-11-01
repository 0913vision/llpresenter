import {afterEach, expect, it} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {useLive} from '@renderer/session/live';
import {outputMenuFixture as fixture} from '@fixtures/renderer/platform/outputMenu';
import {
  outputGroup,
  itemStopEntry,
} from '@renderer/features/presentation/outputControlEntries';

afterEach(() => {
  delete window.llp;
});

it('toggles whole output groups and broadcast through bounded transactions', () => {
  const {input, send} = fixture();
  const audience = input.screens.filter(screen => screen.kind !== 'stage');
  const stage = input.screens.filter(screen => screen.kind === 'stage');
  for (const screens of [audience, stage, audience.slice(1)]) {
    outputGroup(screens, input.outputs).onSelect?.();
  }
  const ids = input.screens.map(screen => screen.id);
  expect(send.mock.calls).toEqual([
    [
      {
        type: 'live.batch',
        commands: ids
          .slice(0, 2)
          .map(screenId => ({type: 'output.set', screenId, on: false})),
      },
    ],
    [
      {
        type: 'live.batch',
        commands: [{type: 'output.set', screenId: ids[2], on: true}],
      },
    ],
    [
      {
        type: 'live.batch',
        commands: [{type: 'output.set', screenId: ids[1], on: true}],
      },
    ],
  ]);
  const source = input.screens[0];
  if (!source) throw new Error('Missing screen');
  send.mockClear();
  const many = Array.from({length: 257}, (_, index) => ({
    ...source,
    id: `screen-${index}`,
  }));
  outputGroup(many, {}).onSelect?.();
  expect(send).toHaveBeenCalledTimes(2);
  expect(send).toHaveBeenNthCalledWith(2, {
    type: 'live.batch',
    commands: [{type: 'output.set', screenId: 'screen-256', on: true}],
  });
});

it('stops an item through its Output command', () => {
  const {send} = fixture();
  const live = {
    ...emptyLiveState(),
    themeItem: {id: 'item', kind: 'song' as const, source: 'service' as const},
  };
  useLive.setState({state: live});
  itemStopEntry(true).onSelect?.();
  expect(send.mock.calls).toEqual([[{type: 'item.stop'}]]);
  useLive.setState({state: null});
});
