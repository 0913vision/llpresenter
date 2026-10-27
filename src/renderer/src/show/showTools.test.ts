import {expect, it} from 'vitest';
import {AVAILABLE_TOOL_TABS, SHOW_TOOLS} from './showTools';

it('retains the specified tool identities and order for future working panels', () => {
  expect(SHOW_TOOLS.map(tool => tool.value)).toEqual([
    'showing',
    'audio',
    'stage',
    'timer',
    'message',
    'notice',
    'prop',
    'macro',
  ]);
});

it('exposes only panels with working controls', () => {
  expect(AVAILABLE_TOOL_TABS).toEqual([
    {value: 'stage', label: '무대'},
    {value: 'timer', label: '타이머'},
    {value: 'message', label: '메시지'},
  ]);
});
