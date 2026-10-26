import {expect, it} from 'vitest';
import {SHOW_TOOLS, showToolGroups, showToolLabel} from './showTools';

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

it.each(['normal', 'wide'] as const)(
  'shows all eight tabs and no 더 보기 in a %s window',
  sizeClass => {
    const {tabs, more} = showToolGroups(sizeClass);
    expect(tabs).toEqual(SHOW_TOOLS);
    expect(more).toEqual([]);
  },
);

it('keeps 표시 중 and 무대 as tabs and the rest in 더 보기 in a narrow window', () => {
  const {tabs, more} = showToolGroups('narrow');
  expect(labels(tabs)).toEqual(['표시 중', '무대']);
  expect(labels(more)).toEqual([
    '오디오',
    '타이머',
    '메시지',
    '공지',
    '소품',
    '매크로',
  ]);
});

it('names each tool by its tab label', () => {
  expect(showToolLabel('timer')).toBe('타이머');
  expect(showToolLabel('showing')).toBe('표시 중');
});
