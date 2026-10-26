import {expect, it} from 'vitest';
import {ALL_TOOL_TABS, COMPACT_TOOL_TABS, SHOW_TOOLS} from './showTools';

const labels = (tools: ReadonlyArray<{readonly label: string}>) =>
  tools.map(tool => tool.label);

it('lists the eight tools in the order of spec 04', () => {
  expect(labels(SHOW_TOOLS)).toEqual([
    '표시 중',
    '오디오',
    '무대',
    '타이머',
    '메시지',
    '공지',
    '소품',
    '매크로',
  ]);
});

it('shows all eight tools as tabs when they fit', () => {
  expect(ALL_TOOL_TABS).toEqual({tabs: SHOW_TOOLS, more: []});
});

it('keeps 표시 중 and 무대 as tabs and the rest in 더 보기 when compact', () => {
  expect(labels(COMPACT_TOOL_TABS.tabs)).toEqual(['표시 중', '무대']);
  expect(labels(COMPACT_TOOL_TABS.more)).toEqual([
    '오디오',
    '타이머',
    '메시지',
    '공지',
    '소품',
    '매크로',
  ]);
});
