/** The 진행 도구 tabs, in the order of spec 04. */
export const SHOW_TOOLS = [
  {value: 'showing', label: '표시 중'},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
  {value: 'timer', label: '타이머'},
  {value: 'message', label: '메시지'},
  {value: 'notice', label: '공지'},
  {value: 'prop', label: '소품'},
  {value: 'macro', label: '매크로'},
] as const satisfies ReadonlyArray<{value: string; label: string}>;

export type ShowToolEntry = (typeof SHOW_TOOLS)[number];
export type ShowTool = ShowToolEntry['value'];

/** The tools shown as tabs and the tools in the 더 보기 menu. */
export interface ShowToolGroups {
  readonly tabs: readonly ShowToolEntry[];
  readonly more: readonly ShowToolEntry[];
}

const COMPACT_TABS: ReadonlySet<ShowTool> = new Set(['showing', 'stage']);

/** All eight tools as tabs. */
export const ALL_TOOL_TABS: ShowToolGroups = {tabs: SHOW_TOOLS, more: []};

/**
 * 표시 중 and 무대 as tabs and the other six in 더 보기, for a narrow window
 * or a panel too narrow for all eight.
 */
export const COMPACT_TOOL_TABS: ShowToolGroups = {
  tabs: SHOW_TOOLS.filter(tool => COMPACT_TABS.has(tool.value)),
  more: SHOW_TOOLS.filter(tool => !COMPACT_TABS.has(tool.value)),
};
